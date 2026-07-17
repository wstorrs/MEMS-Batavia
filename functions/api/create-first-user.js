const ITERATIONS = 310000;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(message = "", error = false) {
  const notice = message
    ? `<div class="notice ${error ? "error" : "success"}">${escapeHtml(message)}</div>`
    : "";

  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Create First Administrator</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0f2347;color:#fff;font-family:Arial,sans-serif}
main{width:min(520px,100%);padding:32px;border-radius:18px;background:#07162f;box-shadow:0 24px 70px #0007}
h1{margin-top:0;color:#ff671f}p{line-height:1.5;color:#dbe4f2}label{display:block;margin-top:18px;font-weight:700}
input{width:100%;margin-top:7px;padding:13px;border-radius:9px;border:0;font:inherit}
button{width:100%;margin-top:24px;padding:14px;border:0;border-radius:9px;background:#ff671f;font:inherit;font-weight:800;cursor:pointer}
.notice{margin:18px 0;padding:12px;border-radius:9px;background:#ffffff14}.error{color:#ffd2cc}.success{color:#b7f7c5}
.small{font-size:.9rem}
</style>
</head>
<body>
<main>
<h1>Create First Administrator</h1>
<p>Mercy Flight EMS – Batavia Vehicle Dashboard</p>
${notice}
${message ? "" : `<form method="post">
<label>Mercy Flight email<input type="email" name="username" autocomplete="username" required></label>
<label>Display name<input type="text" name="displayName" autocomplete="name" required></label>
<label>Password<input type="password" name="password" autocomplete="new-password" minlength="14" required></label>
<label>Confirm password<input type="password" name="confirmPassword" autocomplete="new-password" minlength="14" required></label>
<button type="submit">Create Administrator</button>
</form>`}
<p class="small">Delete <strong>functions/api/create-first-user.js</strong> immediately after the account is created.</p>
</main>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
    },
  });
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    256,
  );
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function onRequestGet({ env }) {
  if (!env.AUTH_DB) return page("AUTH_DB binding is not configured.", true);
  const row = await env.AUTH_DB.prepare("SELECT COUNT(*) AS total FROM users").first();
  if (Number(row?.total || 0) > 0) {
    return page("Setup is locked because an administrator already exists. Delete this file from GitHub.", true);
  }
  return page();
}

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_DB) return page("AUTH_DB binding is not configured.", true);

  const row = await env.AUTH_DB.prepare("SELECT COUNT(*) AS total FROM users").first();
  if (Number(row?.total || 0) > 0) {
    return page("Setup is locked because an administrator already exists. Delete this file from GitHub.", true);
  }

  const form = await request.formData();
  const username = String(form.get("username") || "").trim().toLowerCase();
  const displayName = String(form.get("displayName") || "").trim();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirmPassword") || "");

  if (!username.endsWith("@mercyflight.org")) return page("Use a valid @mercyflight.org email address.", true);
  if (displayName.length < 2 || displayName.length > 100) return page("Display name must be between 2 and 100 characters.", true);
  if (password.length < 14) return page("Password must contain at least 14 characters.", true);
  if (password !== confirm) return page("The passwords do not match.", true);

  const now = new Date().toISOString();
  const result = await env.AUTH_DB.prepare(
    `INSERT INTO users
     (username, display_name, password_hash, role, enabled, created_at)
     VALUES (?, ?, ?, 'admin', 1, ?)`,
  ).bind(username, displayName, await hashPassword(password), now).run();

  await env.AUTH_DB.prepare(
    `INSERT INTO audit_log
     (user_id, username, action, ip_address, user_agent, created_at)
     VALUES (?, ?, 'FIRST_ADMIN_CREATED', ?, ?, ?)`,
  ).bind(
    result.meta.last_row_id,
    username,
    request.headers.get("CF-Connecting-IP") || "unknown",
    (request.headers.get("User-Agent") || "unknown").slice(0, 500),
    now,
  ).run();

  return page("Administrator created. Delete create-first-user.js, wait for deployment, then sign in at /auth/login.html.");
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET, POST" } });
}
