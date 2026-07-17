const SESSION_COOKIE = "mf_batavia_session";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const output = new Uint8Array(hex.length / 2);
  for (let i = 0; i < output.length; i += 1) {
    output[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return output;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );

  return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPassword(password, stored) {
  try {
    const [algorithm, iterationsText, saltHex, hashHex] = stored.split("$");
    if (algorithm !== "pbkdf2-sha256") return false;

    const iterations = Number.parseInt(iterationsText, 10);
    if (!Number.isSafeInteger(iterations) || iterations < 100000) return false;

    const actual = await derive(password, hexToBytes(saltHex), iterations);
    return timingSafeEqual(actual, hexToBytes(hashHex));
  } catch {
    return false;
  }
}

async function recordAttempt(env, username, ip, successful) {
  await env.AUTH_DB.prepare(
    `INSERT INTO login_attempts
     (username, ip_address, successful, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(username, ip, successful ? 1 : 0, new Date().toISOString())
    .run();
}

async function locked(env, username, ip) {
  const cutoff = new Date(
    Date.now() - LOCKOUT_MINUTES * 60 * 1000,
  ).toISOString();

  const row = await env.AUTH_DB.prepare(
    `SELECT COUNT(*) AS failures
     FROM login_attempts
     WHERE successful = 0
       AND created_at >= ?
       AND (username = ? OR ip_address = ?)`,
  )
    .bind(cutoff, username, ip)
    .first();

  return Number(row?.failures || 0) >= MAX_FAILURES;
}

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_DB) return json({ ok: false, error: "AUTH_DB is not configured." }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const username = normalizeEmail(body.username);
  const password = String(body.password || "");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const agent = (request.headers.get("User-Agent") || "unknown").slice(0, 500);

  if (!username || !password) {
    return json({ ok: false, error: "Enter your email address and password." }, 400);
  }

  if (await locked(env, username, ip)) {
    return json(
      { ok: false, error: "Too many unsuccessful attempts. Wait 15 minutes and try again." },
      429,
      { "Retry-After": "900" },
    );
  }

  const user = await env.AUTH_DB.prepare(
    `SELECT id, username, display_name, password_hash, role, enabled
     FROM users WHERE username = ? LIMIT 1`,
  )
    .bind(username)
    .first();

  const valid =
    user?.enabled === 1 &&
    (await verifyPassword(password, user.password_hash));

  if (!valid) {
    await recordAttempt(env, username, ip, false);
    await env.AUTH_DB.prepare(
      `INSERT INTO audit_log
       (user_id, username, action, ip_address, user_agent, created_at)
       VALUES (?, ?, 'LOGIN_FAILED', ?, ?, ?)`,
    )
      .bind(user?.id || null, username, ip, agent, new Date().toISOString())
      .run();

    return json({ ok: false, error: "The email address or password is incorrect." }, 401);
  }

  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  const rawToken = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const sessionId = crypto.randomUUID();

  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare(
      `INSERT INTO sessions
       (id, user_id, token_hash, created_at, expires_at, last_seen, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      sessionId,
      user.id,
      await sha256Hex(rawToken),
      now.toISOString(),
      expires.toISOString(),
      now.toISOString(),
      ip,
      agent,
    ),
    env.AUTH_DB.prepare("UPDATE users SET last_login = ? WHERE id = ?")
      .bind(now.toISOString(), user.id),
    env.AUTH_DB.prepare(
      `INSERT INTO audit_log
       (user_id, username, action, ip_address, user_agent, created_at)
       VALUES (?, ?, 'LOGIN_SUCCESS', ?, ?, ?)`,
    ).bind(user.id, user.username, ip, agent, now.toISOString()),
    env.AUTH_DB.prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .bind(now.toISOString()),
  ]);

  await recordAttempt(env, username, ip, true);

  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${SESSION_HOURS * 60 * 60}`,
  ].join("; ");

  return json(
    {
      ok: true,
      user: {
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    },
    200,
    { "Set-Cookie": cookie },
  );
}

export function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  return onRequestPost(context);
}
