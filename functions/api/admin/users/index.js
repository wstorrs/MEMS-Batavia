function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestGet(context) {
  try {
    const auth = context.data?.auth;

    if (!auth) {
      return jsonResponse(
        { ok: false, error: "Authentication required." },
        401
      );
    }

    if (auth.role !== "admin") {
      return jsonResponse(
        { ok: false, error: "Administrator access is required." },
        403
      );
    }

    if (!context.env.AUTH_DB) {
      return jsonResponse(
        { ok: false, error: "AUTH_DB binding is not configured." },
        500
      );
    }

    const result = await context.env.AUTH_DB.prepare(
      `SELECT
         id,
         username,
         display_name,
         role,
         enabled
       FROM users
       ORDER BY
         CASE WHEN enabled = 1 THEN 0 ELSE 1 END,
         LOWER(display_name),
         LOWER(username)`
    ).all();

    const users = (result.results || []).map(user => ({
      id: user.id,
      username: user.username || "",
      displayName: user.display_name || "",
      role: user.role || "read-only",
      enabled: user.enabled === 1
    }));

    return jsonResponse({
      ok: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error("Unable to list users:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Unable to load users.",
        details: String(error)
      },
      500
    );
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed."
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Allow": "GET"
        }
      }
    );
  }

  return onRequestGet(context);
}
