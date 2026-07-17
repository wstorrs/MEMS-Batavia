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

  if (!Number.isInteger(userId) || userId <= 0) {
    return jsonResponse(
      {
        ok: false,
        error: "A valid user ID is required."
      },
      400
    );
  }

  if (userId === authorization.auth.userId) {
    return jsonResponse(
      {
        ok: false,
        error: "Use the Log Out button to end your own session."
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

  const result = await context.env.AUTH_DB.prepare(
    "DELETE FROM sessions WHERE user_id = ?"
  )
    .bind(userId)
    .run();

  await writeAudit(context.env, {
    actor: authorization.auth,
    action: "USER_FORCE_LOGOUT",
    targetUser: {
      id: existingUser.id,
      username: existingUser.username
    },
    details: {
      sessionsDeleted:
        result.meta?.changes ??
        result.meta?.rows_written ??
        0
    },
    request: context.request
  });

  return jsonResponse({
    ok: true,
    message: "All active sessions for this user were ended."
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
