export const TRANSACTION_COOKIE = "__Host-oauth-tx";
export const SESSION_COOKIE = "__Host-session";
export const SESSION_TTL = 8 * 60 * 60;

export function responseHeaders(extra = {}) {
  return { "Cache-Control": "no-store", ...extra };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: responseHeaders(extraHeaders),
  });
}

export function cookieValue(request, name) {
  const prefix = `${name}=`;
  const cookie = request.headers.get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? cookie.slice(prefix.length) : null;
}

export function setCookie(name, value, maxAge, sameSite) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

export function clearedCookie(name, sameSite) {
  return setCookie(name, "", 0, sameSite);
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function providerConfig(provider, env) {
  if (provider !== "google" && provider !== "github") return null;
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  const baseUrl = env.PUBLIC_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) return null;

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  if (base.protocol !== "https:" || !base.hostname.endsWith(".pages.dev") || base.origin !== baseUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/oauth/callback/${provider}`,
  };
}

export async function createPkceChallenge(verifier) {
  return sha256(verifier);
}

export async function exchangeAuthorizationCode(provider, config, code, verifier) {
  const endpoint = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : "https://github.com/login/oauth/access_token";
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: verifier,
    redirect_uri: config.redirectUri,
  });
  if (provider === "google") body.set("grant_type", "authorization_code");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Token exchange failed");

  const tokens = await response.json().catch(() => null);
  if (provider === "google") {
    if (typeof tokens?.id_token !== "string") throw new Error("Identity token missing");
    return { idToken: tokens.id_token };
  }

  if (
    typeof tokens?.access_token !== "string" ||
    typeof tokens?.token_type !== "string" ||
    tokens.token_type.toLowerCase() !== "bearer"
  ) {
    throw new Error("Access token missing");
  }
  return { accessToken: tokens.access_token };
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
}

export async function verifyGoogleIdentity(idToken, clientId, expectedNonce) {
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("Invalid identity token");

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const claims = decodeJsonPart(encodedClaims);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported identity token");
  }

  const discoveryResponse = await fetch("https://accounts.google.com/.well-known/openid-configuration");
  if (!discoveryResponse.ok) throw new Error("Identity discovery failed");
  const discovery = await discoveryResponse.json();
  if (discovery.issuer !== "https://accounts.google.com") throw new Error("Unexpected identity issuer");

  const keysUrl = new URL(discovery.jwks_uri);
  if (keysUrl.protocol !== "https:" || !keysUrl.hostname.endsWith("googleapis.com")) {
    throw new Error("Unexpected signing keys URL");
  }
  const keysResponse = await fetch(keysUrl);
  if (!keysResponse.ok) throw new Error("Signing keys unavailable");
  const keySet = await keysResponse.json();
  const jwk = keySet.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Signing key not found");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedContent = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);
  const validSignature = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    fromBase64Url(encodedSignature),
    signedContent,
  );

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = claims.aud === clientId || claims.aud?.includes?.(clientId);
  if (
    !validSignature ||
    claims.iss !== "https://accounts.google.com" ||
    !audienceMatches ||
    (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) ||
    !Number.isFinite(claims.exp) || claims.exp <= now ||
    !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
    !constantTimeEqual(claims.nonce, expectedNonce) ||
    typeof claims.sub !== "string" || !claims.sub
  ) {
    throw new Error("Identity token validation failed");
  }

  return {
    issuer: "https://accounts.google.com",
    subject: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: typeof claims.name === "string" ? claims.name : null,
  };
}

export async function getGitHubIdentity(accessToken, config) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    redirect: "manual",
  });
  if (response.status !== 200) throw new Error("GitHub profile unavailable");

  const user = await response.json();
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.login !== "string") {
    throw new Error("GitHub profile invalid");
  }

  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const revocation = await fetch(
    `https://api.github.com/applications/${encodeURIComponent(config.clientId)}/grant`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      body: JSON.stringify({ access_token: accessToken }),
      redirect: "manual",
    },
  );
  if (revocation.status !== 204) throw new Error("GitHub authorization revocation failed");

  return {
    issuer: "https://github.com",
    subject: String(user.id),
    email: typeof user.email === "string" ? user.email : null,
    displayName: typeof user.name === "string" && user.name ? user.name : user.login,
  };
}