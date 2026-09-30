import {
  SESSION_COOKIE,
  SESSION_TTL,
  TRANSACTION_COOKIE,
  clearedCookie,
  constantTimeEqual,
  cookieValue,
  exchangeAuthorizationCode,
  getGitHubIdentity,
  providerConfig,
  randomToken,
  responseHeaders,
  setCookie,
  sha256,
  verifyGoogleIdentity,
} from "../../_lib/oauth.js";

function failedCallback(status = 400) {
  return Response.json(
    { error: "Login could not be completed" },
    {
      status,
      headers: responseHeaders({ "Set-Cookie": clearedCookie(TRANSACTION_COOKIE, "Lax") }),
    },
  );
}

export async function onRequestGet({ request, env, params }) {
  const provider = params.provider;
  if (provider !== "google" && provider !== "github") return failedCallback(404);

  const config = providerConfig(provider, env);
  if (!config || !env.DB) return failedCallback(503);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.has("error") || !code || !state) return failedCallback();

  const transactionCookie = cookieValue(request, TRANSACTION_COOKIE);
  if (!transactionCookie) return failedCallback();

  try {
    const transactionHash = await sha256(transactionCookie);
    const now = Math.floor(Date.now() / 1000);
    const transaction = await env.DB.prepare(
      "SELECT state_hash, nonce, code_verifier FROM oauth_transactions WHERE id_hash = ? AND provider = ? AND expires_at > ?",
    ).bind(transactionHash, provider, now).first();
    if (!transaction) return failedCallback();

    await env.DB.prepare("DELETE FROM oauth_transactions WHERE id_hash = ?").bind(transactionHash).run();
    if (!constantTimeEqual(await sha256(state), transaction.state_hash)) return failedCallback();

    const tokens = await exchangeAuthorizationCode(provider, config, code, transaction.code_verifier);
    const identity = provider === "google"
      ? await verifyGoogleIdentity(tokens.idToken, config.clientId, transaction.nonce)
      : await getGitHubIdentity(tokens.accessToken, config);

    const sessionId = randomToken();
    const sessionHash = await sha256(sessionId);
    const expiresAt = now + SESSION_TTL;
    await env.DB.prepare(
      "INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      sessionHash,
      identity.issuer,
      identity.subject,
      identity.email,
      identity.displayName,
      expiresAt,
      now,
    ).run();

    const headers = new Headers(responseHeaders({ Location: config.baseUrl }));
    headers.append("Set-Cookie", clearedCookie(TRANSACTION_COOKIE, "Lax"));
    headers.append("Set-Cookie", setCookie(SESSION_COOKIE, sessionId, SESSION_TTL, "Strict"));
    return new Response(null, { status: 303, headers });
  } catch {
    return failedCallback(502);
  }
}