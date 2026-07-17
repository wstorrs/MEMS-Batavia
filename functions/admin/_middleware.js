const SESSION_COOKIE = "mf_batavia_session";

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function redirectToLogin(request) {
  const url = new URL(request.url);
  const loginUrl = new URL("/auth/login.html", url.origin);

  loginUrl.searchParams.set(
    "returnTo",
    `${url.pathname}${url.search}`
  );

  return Response.redirect(loginUrl.toString(), 302);
}

function clearSessionCookie(response) {
  const updatedResponse = new Response(response.body, response);

  updatedResponse.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );

  return updatedResponse;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.AUTH_DB) {
    return new Response(
      "AUTH_DB binding is not configured.",
      { status: 500 }
    );
  }

  const rawToken = getCookie(request, SESSION_COOKIE);

  if (!rawToken) {
    return redirectToLogin(request);
  }

  const tokenHash = await sha256Hex(rawToken);

  const session = await env.AUTH_DB.prepare(
    `SELECT
       sessions.id AS session_id,
       sessions.user_id,
       sessions.expires_at,
       users.username,
       users.display_name,
       users.role,
       users.enabled
     FROM sessions
     INNER JOIN users
       ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
     LIMIT 1`
  )
    .bind(tokenHash)
    .first();

  const now = new Date().toISOString();

  if (
    !session ||
    session.enabled !== 1 ||
    session.expires_at <= now
  ) {
    if (session?.session_id) {
      context.waitUntil(
        env.AUTH_DB.prepare(
          "DELETE FROM sessions WHERE id = ?"
        )
          .bind(session.session_id)
          .run()
      );
    }

    return clearSessionCookie(
      redirectToLogin(request)
    );
  }

  context.data.auth = {
    userId: session.user_id,
    username: session.username,
    displayName: session.display_name,
    role: session.role,
    sessionId: session.session_id
  };

  context.waitUntil(
    env.AUTH_DB.prepare(
      "UPDATE sessions SET last_seen = ? WHERE id = ?"
    )
      .bind(now, session.session_id)
      .run()
  );

  const response = await context.next();
  const updatedResponse = new Response(response.body, response);

  updatedResponse.headers.set("Cache-Control", "no-store");
  updatedResponse.headers.set("X-Frame-Options", "DENY");
  updatedResponse.headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );
  updatedResponse.headers.set(
    "Referrer-Policy",
    "same-origin"
  );

  return updatedResponse;
}
