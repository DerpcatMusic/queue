/**
 * Airwallex HTTP Client
 *
 * Authenticated request handling for Airwallex API.
 * Uses bearer-token API authentication and HMAC-SHA256 for webhook verification.
 */

import { ConvexError } from "convex/values";
import { getAirwallexAccessToken } from "./auth";
import {
  type AirwallexEnvironment,
  resolveAirwallexBaseUrl,
  resolveAirwallexWebhookSecret,
} from "./config";

// =============================================================================
// Types
// =============================================================================

export type AirwallexRestMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface AirwallexHttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

// =============================================================================
// API Endpoints
// =============================================================================

export const AIRWALLEX_ENDPOINTS = {
  AUTH_LOGIN: "/api/v1/authentication/login",
  AUTH_AUTHORIZE: "/api/v1/authentication/authorize",

  // Payment Intents (Checkout)
  PAYMENT_INTENTS_CREATE: "/api/v1/pa/payment_intents/create",
  PAYMENT_INTENTS_GET: (id: string) => `/api/v1/pa/payment_intents/${id}`,
  PAYMENT_INTENTS_CONFIRM: (id: string) => `/api/v1/pa/payment_intents/${id}/confirm`,
  PAYMENT_INTENTS_CONFIRM_CONTINUE: (id: string) =>
    `/api/v1/pa/payment_intents/${id}/confirm_continue`,

  // Funds split
  FUNDS_SPLITS_CREATE: "/api/v1/pa/funds_splits/create",
  FUNDS_SPLITS_GET: (id: string) => `/api/v1/pa/funds_splits/${id}`,
  FUNDS_SPLITS_RELEASE: (id: string) => `/api/v1/pa/funds_splits/${id}/release`,
  FUNDS_SPLIT_REVERSALS_CREATE: "/api/v1/pa/funds_split_reversals/create",

  // Refunds
  REFUNDS_CREATE: "/api/v1/pa/refunds/create",
  REFUNDS_GET: (id: string) => `/api/v1/pa/refunds/${id}`,

  // Beneficiaries (for payouts)
  BENEFICIARIES_CREATE: "/api/v1/beneficiaries/create",
  BENEFICIARIES_GET: (id: string) => `/api/v1/beneficiaries/${id}`,
  BENEFICIARIES_LIST: "/api/v1/beneficiaries/list",

  // Transfers (payouts from platform to connected account)
  // Note: Airwallex renamed /transfers/* → /connected_account_transfers/*
  TRANSFERS_CREATE: "/api/v1/connected_account_transfers/create",
  TRANSFERS_GET: (id: string) => `/api/v1/connected_account_transfers/${id}`,
  TRANSFERS_LIST: "/api/v1/connected_account_transfers/list",
  CONNECTED_ACCOUNT_TRANSFERS_CREATE: "/api/v1/connected_account_transfers/create",
  CONNECTED_ACCOUNT_TRANSFERS_GET: (id: string) => `/api/v1/connected_account_transfers/${id}`,
  CONNECTED_ACCOUNT_TRANSFERS_LIST: "/api/v1/connected_account_transfers/list",

  // Webhooks
  WEBHOOKS_CREATE: "/api/v1/webhooks/create",
  WEBHOOKS_GET: (id: string) => `/api/v1/webhooks/${id}`,
  WEBHOOKS_UPDATE: (id: string) => `/api/v1/webhooks/${id}/update`,
  WEBHOOKS_LIST: "/api/v1/webhooks",

  // Connected Accounts (for KYC)
  ACCOUNTS_CREATE: "/api/v1/accounts/create",
  ACCOUNTS_GET: (id: string) => `/api/v1/accounts/${id}`,
  ACCOUNTS_SUBMIT: (id: string) => `/api/v1/accounts/${id}/submit`,
  ACCOUNTS_UPDATE: (id: string) => `/api/v1/accounts/${id}/update`,
} as const;

// =============================================================================
// HTTP Client
// =============================================================================

const DEFAULT_TIMEOUT_MS = 15000;

export const executeAirwallexRequest = async <T = unknown>(params: {
  method: AirwallexRestMethod;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}): Promise<AirwallexHttpResponse<T>> => {
  const baseUrl = resolveAirwallexBaseUrl();
  const accessToken = await getAirwallexAccessToken();
  const requestUrl = `${baseUrl}${params.path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  if (params.idempotencyKey) {
    headers["x-idempotency-key"] = params.idempotencyKey;
  }
  if (params.headers) {
    Object.assign(headers, params.headers);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: params.method,
      headers,
      body: params.body != null ? JSON.stringify(params.body) : null,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // ignore
    }

    const errorMessage =
      (errorData.message as string) ??
      (errorData.error as string) ??
      (errorData.code as string) ??
      `HTTP ${response.status}`;
    const errorCode = errorData.code ?? errorData.error_code;

    throw new ConvexError(
      `Airwallex API error (HTTP ${response.status})${errorCode ? ` [${errorCode}]` : ""}: ${errorMessage}`,
    );
  }

  const data = responseText ? (JSON.parse(responseText) as T) : ({} as T);

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
};

export const executeAirwallexGet = <T = unknown>(
  path: string,
  idempotencyKey?: string,
): Promise<AirwallexHttpResponse<T>> => {
  const args: { method: "GET"; path: string; idempotencyKey?: string } = { method: "GET", path };
  if (idempotencyKey != null) args.idempotencyKey = idempotencyKey;
  return executeAirwallexRequest<T>(args);
};

export const executeAirwallexPost = <T = unknown>(
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<AirwallexHttpResponse<T>> => {
  const args: { method: "POST"; path: string; body: unknown; idempotencyKey?: string } = {
    method: "POST",
    path,
    body,
  };
  if (idempotencyKey != null) args.idempotencyKey = idempotencyKey;
  return executeAirwallexRequest<T>(args);
};

export const executeAirwallexPut = <T = unknown>(
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<AirwallexHttpResponse<T>> => {
  const args: { method: "PUT"; path: string; body: unknown; idempotencyKey?: string } = {
    method: "PUT",
    path,
    body,
  };
  if (idempotencyKey != null) args.idempotencyKey = idempotencyKey;
  return executeAirwallexRequest<T>(args);
};

// =============================================================================
// Webhook Signature Verification
// =============================================================================

/**
 * Airwallex webhook signature verification using HMAC-SHA256.
 * Headers: x-timestamp (string), x-signature (hex string)
 * Signature = HMAC-SHA256(timestamp + payload, secret)
 */
export const verifyAirwallexWebhookSignature = async (
  payload: string,
  timestamp: string,
  signature: string,
  secret?: string,
): Promise<boolean> => {
  const webhookSecret = secret ?? resolveAirwallexWebhookSecret();

  if (!webhookSecret) {
    console.warn("Airwallex webhook secret not configured - skipping signature verification");
    return true;
  }

  const encoder = new TextEncoder();
  const toSign = `${timestamp}${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));

  // Convert signature buffer to hex string
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
};

// =============================================================================
// Environment Info
// =============================================================================

export const getAirwallexEnvironmentInfo = (): {
  environment: AirwallexEnvironment;
  baseUrl: string;
  isProduction: boolean;
} => {
  const baseUrl = resolveAirwallexBaseUrl();
  const env = process.env.AIRWALLEX_ENVIRONMENT?.trim().toLowerCase();
  const environment: AirwallexEnvironment =
    env === "production" ? "production" : env === "demo" ? "demo" : "sandbox";

  return {
    environment,
    baseUrl,
    isProduction: environment === "production",
  };
};
