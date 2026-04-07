import { ConvexError } from "convex/values";
import { resolveAirwallexBaseUrl, resolveAirwallexCredentials } from "./config";

type AirwallexLoginResponse = {
  token?: string;
  access_token?: string;
  expires_at?: string;
  expires_in?: number;
};

type CachedAccessToken = {
  token: string;
  expiresAtMs: number;
};

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

let cachedAccessToken: CachedAccessToken | null = null;
let inflightAccessTokenPromise: Promise<string> | null = null;

const parseExpiryMs = (expiresAt: string | undefined): number => {
  const parsed = Date.parse(expiresAt ?? "");
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.now() + 29 * 60 * 1000;
};

const loginForAccessToken = async (): Promise<string> => {
  const { apiKey, clientId, accountId } = resolveAirwallexCredentials();
  const baseUrl = resolveAirwallexBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-client-id": clientId,
  };
  if (accountId) {
    headers["x-login-as"] = accountId;
  }

  const response = await fetch(`${baseUrl}/api/v1/authentication/login`, {
    method: "POST",
    headers,
  });

  const responseText = await response.text();
  let payload: AirwallexLoginResponse & Record<string, unknown> = {};
  try {
    payload = responseText
      ? (JSON.parse(responseText) as AirwallexLoginResponse & Record<string, unknown>)
      : {};
  } catch {
    payload = {};
  }

  const token = payload.token ?? payload.access_token;
  const expiresAtMs =
    payload.expires_at != null
      ? parseExpiryMs(payload.expires_at)
      : payload.expires_in != null
        ? Date.now() + Math.max(1, payload.expires_in) * 1000
        : Date.now() + 29 * 60 * 1000;

  if (!response.ok || !token) {
    const message =
      (payload.message as string | undefined) ??
      (payload.code as string | undefined) ??
      `HTTP ${response.status}`;
    throw new ConvexError(`Airwallex authentication failed: ${message}`);
  }

  cachedAccessToken = {
    token,
    expiresAtMs,
  };

  return token;
};

export const getAirwallexAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > now &&
    cachedAccessToken.token
  ) {
    return cachedAccessToken.token;
  }

  if (!inflightAccessTokenPromise) {
    inflightAccessTokenPromise = loginForAccessToken().finally(() => {
      inflightAccessTokenPromise = null;
    });
  }

  return await inflightAccessTokenPromise;
};
