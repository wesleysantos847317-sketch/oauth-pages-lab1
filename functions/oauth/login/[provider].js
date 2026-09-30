import {
  TRANSACTION_COOKIE,
  clearedCookie,
  createPkceChallenge,
  jsonResponse,
  providerConfig,
  randomToken,
  setCookie,
  sha256,
} from "../../_lib/oauth.js";

export async function onRequestGet({ request, env, params }) {
  const provider = params.provider;
  const config = providerConfig(provider, env);
  if (!config || !env.DB) {
    return jsonResponse({ error: "Login is unavailable" }, provider === "google" || provider === "github" ? 503 : 404);
  }

  const transactionCookie = randomToken();
  const state = randomToken();
  const nonce = provider === "google" ? randomToken() : null;
  const verifier = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const transactionHash = await sha256(transactionCookie);
  const challenge = await createPkceChallenge(verifier);

  try {
    await env.DB.prepare("DELETE FROM oauth_transactions WHERE expires_at <= ?").bind(now).run();
    await env.DB.prepare(
      "INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(transactionHash, provider, await sha256(state), nonce, verifier, now + 600).run();
  } catch {
    return jsonResponse({ error: "Login is unavailable" }, 503);
  }

  const authorizationUrl = new URL(
    provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://github.com/login/oauth/authorize",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(provider === "google" ? { scope: "openid email profile", nonce } : {}),
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: authorizationUrl.toString(),
      "Set-Cookie": setCookie(TRANSACTION_COOKIE, transactionCookie, 600, "Lax"),
    },
  });
}