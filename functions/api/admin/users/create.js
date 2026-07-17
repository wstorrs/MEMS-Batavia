import {
  createPasswordHash,
  jsonResponse,
  normalizeRole,
  normalizeUsername,
  readJson,
  requireAdmin,
  validatePassword,
  validateRole,
  writeAudit
} from "./_lib.js";

export async function onRequestPost(context) {
  const authorization = await requireAdmin(context);

  if (authorization.error) {
    return authorization.error;
  }

  const body = await readJson(context.request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "A valid JSON request body is required."
      },
      400
    );
  }

  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || "").trim();
  const password = String(body.password || "");
  const role = normalizeRole(body.role || "viewer");
  const enabled = body.enabled !== false;

  if (!username) {
    return jsonResponse(
      {
        ok: false,
        error: "Username is required."
      },
      400
    );
  }

  const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

if (!emailPattern.test(username)) {
  return jsonResponse(
    {
      ok: false,
      error: "A valid email address is required."
    },
    400
  );
}

  if (!displayName) {
    return jsonResponse(
      {
        ok: false,
        error: "Display name is required."
      },
      400
    );
  }

  if (displayName.length > 100) {
    return jsonResponse(
      {
        ok: false,
        error: "Display name cannot exceed 100 characters."
      },
      400
    );
  }

  if (!validateRole(role)) {
    return jsonResponse(
      {
        ok: false,
        error: "Role must be admin, operations, or viewer."
      },
      400
    );
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return jsonResponse(
      {
        ok: false,
        error: passwordError
      },
      400
    );
  }

  const existingUser = await context.env.AUTH_DB.prepare(
    `SELECT id
     FROM users
     WHERE LOWER(username) = LOWER(?)
     LIMIT 1`
  )
    .bind(username)
    .first();

  if (existingUser) {
    return jsonResponse(
      {
        ok: false,
        error: "A user with that username already exists."
      },
      409
    );
  }

  const passwordHash = await createPasswordHash(password);
  const createdAt = new Date().toISOString();

  let result;

  try {
    result = await context.env.AUTH_DB.prepare(
      `INSERT INTO users (
         username,
         display_name,
         password_hash,
         role,
         enabled,
         created_at,
         last_login
       )
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    )
      .bind(
        username,
        displayName,
        passwordHash,
        role,
        enabled ? 1 : 0,
        createdAt
      )
      .run();
  } catch (error) {
    console.error("Create user failed:", error);

    const errorMessage = String(error?.message || error);

    if (
      errorMessage.toLowerCase().includes("unique") ||
      errorMessage.toLowerCase().includes("constraint")
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "A user with that username already exists."
        },
        409
      );
    }

    return jsonResponse(
      {
        ok: false,
        error: "The user account could not be created."
      },
      500
    );
  }

  const userId = Number(result?.meta?.last_row_id);

  await writeAudit(context.env, {
    actor: authorization.auth,
    action: "USER_CREATED",
    targetUser: {
      id: Number.isInteger(userId) ? userId : null,
      username
    },
    details: {
      displayName,
      role,
      enabled
    },
    request: context.request
  });

  return jsonResponse(
    {
      ok: true,
      message: "User account created successfully.",
      user: {
        id: Number.isInteger(userId) ? userId : null,
        username,
        displayName,
        role,
        enabled,
        createdAt,
        lastLogin: null
      }
    },
    201
  );
}

export function onRequest() {
  return jsonResponse(
    {
      ok: false,
      error: "Method not allowed."
    },
    405
  );
}
