const SESSION_COOKIE = "mf_batavia_session";

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function redirectToLogin(request) {
  const url = new URL(request.url);
  const login = new URL("/auth/login.html", url.origin);
  login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
  return Response.redirect(login.toString(), 302);
}

function clearCookie(response) {
  const updated = new Response(response.body, response);
  updated.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  return updated;
}

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;
  const adminPage = path === "/admin" || path.startsWith("/admin/");
  const privateApi =
    path.startsWith("/api/admin/") || path.startsWith("/api/private/");

  if (!adminPage && !privateApi) return context.next();

  if (!env.AUTH_DB) {
    return new Response("AUTH_DB binding is not configured.", { status: 500 });
  }

  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) {
    return privateApi
      ? Response.json({ ok: false, error: "Authentication required." }, { status: 401 })
      : redirectToLogin(request);
  }

  const session = await env.AUTH_DB.prepare(
    `SELECT sessions.id AS session_id, sessions.user_id, sessions.expires_at,
            users.username, users.display_name, users.role, users.enabled
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
     LIMIT 1`,
  )
    .bind(await sha256Hex(rawToken))
    .first();

  const now = new Date().toISOString();

  if (!session || session.enabled !== 1 || session.expires_at <= now) {
    if (session?.session_id) {
      context.waitUntil(
        env.AUTH_DB.prepare("DELETE FROM sessions WHERE id = ?")
          .bind(session.session_id)
          .run(),
      );
    }

    return clearCookie(
      privateApi
        ? Response.json({ ok: false, error: "Authentication required." }, { status: 401 })
        : redirectToLogin(request),
    );
  }

  context.data.auth = {
    userId: session.user_id,
    username: session.username,
    displayName: session.display_name,
    role: session.role,
    sessionId: session.session_id,
  };

  context.waitUntil(
    env.AUTH_DB.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?")
      .bind(now, session.session_id)
      .run(),
  );

  const response = await context.next();
  const updated = new Response(response.body, response);
  updated.headers.set("Cache-Control", "no-store");
  updated.headers.set("X-Frame-Options", "DENY");
  updated.headers.set("X-Content-Type-Options", "nosniff");
  updated.headers.set("Referrer-Policy", "same-origin");
  return updated;
}
