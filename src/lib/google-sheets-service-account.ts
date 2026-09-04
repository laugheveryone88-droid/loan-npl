import "server-only";

import { createSign } from "node:crypto";

import { GOOGLE_SHEETS_READONLY_SCOPE } from "@/lib/google-sheets";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let cachedToken: CachedToken | null = null;

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email && !privateKey) {
    return null;
  }

  if (!email || !privateKey) {
    throw new Error("Google Sheets service account configuration is incomplete.");
  }

  return {
    email,
    privateKey: privateKey.replaceAll("\\n", "\n"),
  };
}

export async function getGoogleServiceAccountAccessToken() {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  const now = Math.floor(Date.now() / 1_000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const header = encodeBase64Url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: credentials.email,
      scope: GOOGLE_SHEETS_READONLY_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now - 30,
      exp: now + 3_600,
    }),
  );
  const unsignedAssertion = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedAssertion);
  signer.end();
  const signature = signer.sign(credentials.privateKey).toString("base64url");

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedAssertion}.${signature}`,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error("Google service account token request failed.");
  }

  const token = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!token.access_token) {
    throw new Error("Google service account did not return an access token.");
  }

  cachedToken = {
    accessToken: token.access_token,
    expiresAt: now + (token.expires_in ?? 3_600),
  };

  return cachedToken.accessToken;
}
