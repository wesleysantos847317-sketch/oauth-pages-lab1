import {
  SESSION_COOKIE,
  cookieValue,
  jsonResponse,
  sha256,
} from "../_lib/oauth.js";

export async function onRequestGet({ request, env }) {
  const sessionCookie = cookieValue(request, SESSION_COOKIE);
  if (!sessionCookie || !env.DB) {
    return jsonResponse({ error: "Unauthenticated" }, 401);
  }

  let session;
  try {
    session = await env.DB.prepare(
      "SELECT email, display_name FROM sessions WHERE id_hash = ? AND expires_at > ?",
    ).bind(await sha256(sessionCookie), Math.floor(Date.now() / 1000)).first();
  } catch {
    return jsonResponse({ error: "Session lookup failed" }, 503);
  }

  if (!session) return jsonResponse({ error: "Unauthenticated" }, 401);
  return jsonResponse({ email: session.email, displayName: session.display_name });
}