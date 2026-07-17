const COOKIE = "mf_batavia_session";

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  if (!env.AUTH_DB) {
    return Response.json(
      { ok: false, authenticated: false, error: "AUTH_DB is not configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const token = getCookie(request, COOKIE);
  if (!token) {
    return Response.json(
      { ok: true, authenticated: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const row = await env.AUTH_DB.prepare(
    `SELECT sessions.id AS session_id, sessions.expires_at,
            users.id AS user_id, users.username, users.display_name,
            users.role, users.enabled
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? LIMIT 1`,
  ).bind(await sha256Hex(token)).first();

  const now = new Date().toISOString();

  if (!row || row.enabled !== 1 || row.expires_at <= now) {
    if (row?.session_id) {
      await env.AUTH_DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(row.session_id).run();
    }

    return Response.json(
      { ok: true, authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        },
      },
    );
  }

  return Response.json(
    {
      ok: true,
      authenticated: true,
      user: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        expiresAt: row.expires_at,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function onRequest(context) {
  if (context.request.method !== "GET") {
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } },
    );
  }
  return onRequestGet(context);
}
