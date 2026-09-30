import {
  SESSION_COOKIE,
  clearedCookie,
  cookieValue,
  jsonResponse,
  responseHeaders,
  sha256,
} from "../_lib/oauth.js";

export async function onRequestPost({ request, env }) {
  const baseUrl = env.PUBLIC_BASE_URL;
  if (!baseUrl || request.headers.get("Origin") !== baseUrl) {
    return jsonResponse({ error: "Invalid origin" }, 403);
  }
  if (!env.DB) return jsonResponse({ error: "Logout is unavailable" }, 503);

  const sessionCookie = cookieValue(request, SESSION_COOKIE);
  if (sessionCookie) {
    try {
      await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?")
        .bind(await sha256(sessionCookie))
        .run();
    } catch {
      return jsonResponse(
        { error: "Logout is unavailable" },
        503,
        { "Set-Cookie": clearedCookie(SESSION_COOKIE, "Strict") },
      );
    }
  }

  const headers = new Headers(responseHeaders({ Location: `${baseUrl}/` }));
  headers.set("Set-Cookie", clearedCookie(SESSION_COOKIE, "Strict"));
  return new Response(null, { status: 303, headers });
}