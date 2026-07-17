import {
  getUserById,
  jsonResponse,
  readJson,
  requireAdmin,
  writeAudit
} from "./_lib.js";

export async function onRequestPost(context) {
  const authorization = await requireAdmin(context);

  if (authorization.error) {
    return authorization.error;
  }

  const body = await readJson(context.request);
  const userId = Number(body?.userId);
  const enabled = body?.enabled === true;

  if (!Number.isInteger(userId) || userId <= 0) {
    return jsonResponse(
      {
        ok: false,
        error: "A valid user ID is required."
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

  if (
    userId === authorization.auth.userId &&
    !enabled
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "You cannot disable your own account."
      },
      400
    );
  }

  await context.env.AUTH_DB.prepare(
    "UPDATE users SET enabled = ? WHERE id = ?"
  )
    .bind(enabled ? 1 : 0, userId)
    .run();

  if (!enabled) {
    await context.env.AUTH_DB.prepare(
      "DELETE FROM sessions WHERE user_id = ?"
    )
      .bind(userId)
      .run();
  }

  await writeAudit(context.env, {
    actor: authorization.auth,
    action: enabled
      ? "USER_ENABLED"
      : "USER_DISABLED",
    targetUser: {
      id: existingUser.id,
      username: existingUser.username
    },
    details: {
      previousEnabled:
        Number(existingUser.enabled) === 1,
      newEnabled: enabled,
      sessionsRevoked: !enabled
    },
    request: context.request
  });

  return jsonResponse({
    ok: true,
    message: enabled
      ? "User account enabled successfully."
      : "User account disabled and active sessions revoked."
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
