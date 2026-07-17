import {
  createPasswordHash,
  getUserById,
  jsonResponse,
  readJson,
  requireAdmin,
  validatePassword,
  writeAudit
} from "./_lib.js";

export async function onRequestPost(context) {
  const authorization = await requireAdmin(context);

  if (authorization.error) {
    return authorization.error;
  }

  const body = await readJson(context.request);
  const userId = Number(body?.userId);
  const newPassword = String(body?.newPassword || "");

  if (!Number.isInteger(userId) || userId <= 0) {
    return jsonResponse(
      {
        ok: false,
        error: "A valid user ID is required."
      },
      400
    );
  }

  const passwordError = validatePassword(newPassword);

  if (passwordError) {
    return jsonResponse(
      {
        ok: false,
        error: passwordError
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

  const passwordHash = await createPasswordHash(
    newPassword
  );

  await context.env.AUTH_DB.prepare(
    "UPDATE users SET password_hash = ? WHERE id = ?"
  )
    .bind(passwordHash, userId)
    .run();

  /*
    Revoke every session after a password reset. The affected user must
    authenticate again with the new password.
  */
  await context.env.AUTH_DB.prepare(
    "DELETE FROM sessions WHERE user_id = ?"
  )
    .bind(userId)
    .run();

  await writeAudit(context.env, {
    actor: authorization.auth,
    action: "USER_PASSWORD_RESET",
    targetUser: {
      id: existingUser.id,
      username: existingUser.username
    },
    details: {
      sessionsRevoked: true
    },
    request: context.request
  });

  return jsonResponse({
    ok: true,
    message:
      userId === authorization.auth.userId
        ? "Your password was reset. You must sign in again."
        : "Password reset successfully. The user must sign in again."
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
