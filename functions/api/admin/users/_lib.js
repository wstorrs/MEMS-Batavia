const SESSION_COOKIE = "mf_batavia_session";
const PASSWORD_ITERATIONS = 310000;
const VALID_ROLES = new Set(["admin", "operations", "viewer"]);

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToHex(bytes) {
  return [...bytes]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "read-only" || normalized === "readonly") {
    return "viewer";
  }

  return normalized;
}

export function validateRole(role) {
  return VALID_ROLES.has(normalizeRole(role));
}

export function validatePassword(password) {
  const value = String(password || "");

  if (value.length < 12) {
    return "Password must contain at least 12 characters.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must contain at least one special character.";
  }

  return null;
}

export async function createPasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PASSWORD_ITERATIONS
    },
    keyMaterial,
    256
  );

  return [
    "pbkdf2-sha256",
    PASSWORD_ITERATIONS,
    bytesToHex(salt),
    bytesToHex(new Uint8Array(derivedBits))
  ].join("$");
}

export async function requireAdmin(context) {
  const { request, env } = context;

  if (!env.AUTH_DB) {
    return {
      error: jsonResponse(
        {
          ok: false,
          error: "AUTH_DB binding is not configured."
        },
        500
      )
    };
  }

  const rawToken = getCookie(request, SESSION_COOKIE);

  if (!rawToken) {
    return {
      error: jsonResponse(
        {
          ok: false,
          error: "Authentication is required."
        },
        401
      )
    };
  }

  const tokenHash = await sha256Hex(rawToken);
  const now = new Date().toISOString();

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

  if (
    !session ||
    Number(session.enabled) !== 1 ||
    session.expires_at <= now
  ) {
    if (session?.session_id) {
      await env.AUTH_DB.prepare(
        "DELETE FROM sessions WHERE id = ?"
      )
        .bind(session.session_id)
        .run();
    }

    return {
      error: jsonResponse(
        {
          ok: false,
          error: "Your session is invalid or has expired."
        },
        401
      )
    };
  }

  if (session.role !== "admin") {
    return {
      error: jsonResponse(
        {
          ok: false,
          error: "Administrator access is required."
        },
        403
      )
    };
  }

  context.waitUntil(
    env.AUTH_DB.prepare(
      "UPDATE sessions SET last_seen = ? WHERE id = ?"
    )
      .bind(now, session.session_id)
      .run()
  );

  return {
    auth: {
      userId: Number(session.user_id),
      username: session.username,
      displayName: session.display_name,
      role: session.role,
      sessionId: session.session_id
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function getRequestMetadata(request) {
  return {
    ipAddress:
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      null,

    userAgent:
      request.headers.get("User-Agent") ||
      null
  };
}

export async function writeAudit(
  env,
  {
    actor,
    action,
    targetUser = null,
    details = null,
    request
  }
) {
  try {
    const schemaResult = await env.AUTH_DB.prepare(
      "PRAGMA table_info(audit_log)"
    ).all();

    const columns = new Set(
      (schemaResult.results || []).map(column => column.name)
    );

    if (!columns.size || !columns.has("action")) {
      return;
    }

    const metadata = getRequestMetadata(request);
    const values = {
      action
    };

    if (columns.has("user_id")) {
      values.user_id = actor?.userId ?? null;
    }

    if (columns.has("actor_user_id")) {
      values.actor_user_id = actor?.userId ?? null;
    }

    if (columns.has("admin_user_id")) {
      values.admin_user_id = actor?.userId ?? null;
    }

    if (columns.has("username")) {
      values.username = actor?.username ?? null;
    }

    if (columns.has("actor_username")) {
      values.actor_username = actor?.username ?? null;
    }

    if (columns.has("target_user_id")) {
      values.target_user_id = targetUser?.id ?? null;
    }

    if (columns.has("target_username")) {
      values.target_username = targetUser?.username ?? null;
    }

    if (columns.has("details")) {
      values.details =
        typeof details === "string"
          ? details
          : JSON.stringify(details || {});
    }

    if (columns.has("message")) {
      values.message =
        typeof details === "string"
          ? details
          : JSON.stringify(details || {});
    }

    if (columns.has("ip_address")) {
      values.ip_address = metadata.ipAddress;
    }

    if (columns.has("ip")) {
      values.ip = metadata.ipAddress;
    }

    if (columns.has("user_agent")) {
      values.user_agent = metadata.userAgent;
    }

    if (columns.has("created_at")) {
      values.created_at = new Date().toISOString();
    }

    if (columns.has("timestamp")) {
      values.timestamp = new Date().toISOString();
    }

    const insertColumns = Object.keys(values);
    const placeholders = insertColumns.map(() => "?").join(", ");

    await env.AUTH_DB.prepare(
      `INSERT INTO audit_log (${insertColumns.join(", ")})
       VALUES (${placeholders})`
    )
      .bind(...insertColumns.map(column => values[column]))
      .run();
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

export async function getUserById(env, userId) {
  return env.AUTH_DB.prepare(
    `SELECT
       id,
       username,
       display_name,
       role,
       enabled,
       created_at,
       last_login
     FROM users
     WHERE id = ?
     LIMIT 1`
  )
    .bind(userId)
    .first();
}
