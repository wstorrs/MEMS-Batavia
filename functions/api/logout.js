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

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, COOKIE);

  if (env.AUTH_DB && token) {
    const hash = await sha256Hex(token);
    const session = await env.AUTH_DB.prepare(
      `SELECT sessions.id, sessions.user_id, users.username
       FROM sessions LEFT JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? LIMIT 1`,
    ).bind(hash).first();

    if (session) {
      await env.AUTH_DB.batch([
        env.AUTH_DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id),
        env.AUTH_DB.prepare(
          `INSERT INTO audit_log
           (user_id, username, action, ip_address, user_agent, created_at)
           VALUES (?, ?, 'LOGOUT', ?, ?, ?)`,
        ).bind(
          session.user_id,
          session.username || null,
          request.headers.get("CF-Connecting-IP") || "unknown",
          (request.headers.get("User-Agent") || "unknown").slice(0, 500),
          new Date().toISOString(),
        ),
      ]);
    }
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    },
  );
}

export function onRequest(context) {
  if (context.request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
    );
  }
  return onRequestPost(context);
}
