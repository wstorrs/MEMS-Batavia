import {
  getUserById,
  jsonResponse,
  normalizeRole,
  normalizeUsername,
  readJson,
  requireAdmin,
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

  const userId = Number(body.userId);
  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || "").trim();
  const role = normalizeRole(body.role);

  if (!Number.isInteger(userId) || userId <= 0) {
    return jsonResponse(
      {
        ok: false,
        error: "A valid user ID is required."
      },
      400
    );
  }

  if (!username) {
    return jsonResponse(
      {
        ok: false,
        error: "Username is required."
      },
      400
    );
  }

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Username must be 3–50 characters and may contain only letters, numbers, periods, underscores, and hyphens."
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

  const existingUser = await getUserById(
    context.env,
    userId
  );

  if (!existingUser) {
    return jsonResponse(
      {
        ok: false,
        error: "The selected user account was not found."
      },
      404
    );
  }

  /*
    Prevent the currently signed-in administrator from removing
    their own administrative privileges.
  */
  if (
    userId === authorization.auth.userId &&
    role !== "admin"
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "You cannot remove administrator access from your own account."
      },
      400
    );
  }

  const duplicateUser = await context.env.AUTH_DB.prepare(
    `SELECT id
     FROM users
     WHERE LOWER(username) = LOWER(?)
       AND id <> ?
     LIMIT 1`
  )
    .bind(username, userId)
    .first();

  if (duplicateUser) {
    return jsonResponse(
      {
        ok: false,
        error: "A user with that username already exists."
      },
      409
    );
  }

  try {
    await context.env.AUTH_DB.prepare(
      `UPDATE users
       SET
         username = ?,
         display_name = ?,
         role = ?
       WHERE id = ?`
    )
      .bind(
        username,
        displayName,
        role,
        userId
      )
      .run();
  } catch (error) {
    console.error("Update user failed:", error);

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
        error: "The user account could not be updated."
      },
      500
    );
  }

  /*
    If the user's role changed, revoke existing sessions so the
    new permissions take effect the next time they sign in.

    Do not revoke the current administrator's session when they
    are editing only their own name or username.
  */
  const roleChanged = existingUser.role !== role;

  if (
    roleChanged &&
    userId !== authorization.auth.userId
  ) {
    await context.env.AUTH_DB.prepare(
      "DELETE FROM sessions WHERE user_id = ?"
    )
      .bind(userId)
      .run();
  }

  await writeAudit(context.env, {
    actor: authorization.auth,
    action: "USER_UPDATED",
    targetUser: {
      id: existingUser.id,
      username
    },
    details: {
      previous: {
        username: existingUser.username,
        displayName: existingUser.display_name,
        role: existingUser.role
      },
      updated: {
        username,
        displayName,
        role
      },
      sessionsRevoked:
        roleChanged &&
        userId !== authorization.auth.userId
    },
    request: context.request
  });

  return jsonResponse({
    ok: true,
    message: "User account updated successfully.",
    user: {
      id: userId,
      username,
      displayName,
      role,
      enabled: Number(existingUser.enabled) === 1,
      createdAt: existingUser.created_at,
      lastLogin: existingUser.last_login
    }
  });
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
