/**
 * Airwallex Integration Configuration
 *
 * Environment variables and configuration for Airwallex API.
 */

import { ConvexError } from "convex/values";

// =============================================================================
// Types
// =============================================================================

export type AirwallexEnvironment = "sandbox" | "production" | "demo";

export interface AirwallexEnvPresence {
  airwallex: {
    AIRWALLEX_API_KEY: boolean;
    AIRWALLEX_CLIENT_ID: boolean;
    AIRWALLEX_ENVIRONMENT: boolean;
  };
  readyForCheckout: boolean;
  readyForPayouts: boolean;
  environment: AirwallexEnvironment;
}

// =============================================================================
// Environment Variable Names
// =============================================================================

const REQUIRED_AIRWALLEX_ENV_KEYS = ["AIRWALLEX_API_KEY", "AIRWALLEX_CLIENT_ID"] as const;

const OPTIONAL_AIRWALLEX_ENV_KEYS = [
  "AIRWALLEX_WEBHOOK_SECRET",
  "AIRWALLEX_ENVIRONMENT",
  "AIRWALLEX_ACCOUNT_ID",
  "AIRWALLEX_PAYOUT_BENEFICIARY_ID",
] as const;

// =============================================================================
// Environment Resolution
// =============================================================================

export const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConvexError(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

export const resolveAirwallexEnvironment = (): AirwallexEnvironment => {
  const env = process.env.AIRWALLEX_ENVIRONMENT?.trim().toLowerCase();
  if (env === "production") return "production";
  if (env === "demo") return "demo";
  return "sandbox";
};

// =============================================================================
// Base URLs
// =============================================================================

const AIRWALLEX_BASE_URLS: Record<AirwallexEnvironment, string> = {
  sandbox: "https://api-sandbox.airwallex.com",
  demo: "https://api-demo.airwallex.com",
  production: "https://api.airwallex.com",
};

export const resolveAirwallexBaseUrl = (): string => {
  const env = resolveAirwallexEnvironment();
  return AIRWALLEX_BASE_URLS[env];
};

export const resolveAirwallexApiUrl = (path: string): string => {
  const base = resolveAirwallexBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

// =============================================================================
// Credentials
// =============================================================================

export interface AirwallexCredentials {
  apiKey: string;
  clientId: string;
  accountId?: string;
  environment: AirwallexEnvironment;
}

export const resolveAirwallexCredentials = (): AirwallexCredentials => {
  const creds: AirwallexCredentials = {
    apiKey: getRequiredEnv("AIRWALLEX_API_KEY"),
    clientId: getRequiredEnv("AIRWALLEX_CLIENT_ID"),
    environment: resolveAirwallexEnvironment(),
  };
  const accountId = getOptionalEnv("AIRWALLEX_ACCOUNT_ID");
  if (accountId) creds.accountId = accountId;
  return creds;
};

// =============================================================================
// Webhook Secret
// =============================================================================

export const resolveAirwallexWebhookSecret = (): string | undefined => {
  return getOptionalEnv("AIRWALLEX_WEBHOOK_SECRET");
};

// =============================================================================
// Payout Beneficiary ID (for platform payouts)
// =============================================================================

export const resolveAirwallexPayoutBeneficiaryId = (): string | undefined => {
  return getOptionalEnv("AIRWALLEX_PAYOUT_BENEFICIARY_ID");
};

// =============================================================================
// Environment Presence Check
// =============================================================================

export const getAirwallexEnvPresence = (): AirwallexEnvPresence => {
  const required = Object.fromEntries(
    REQUIRED_AIRWALLEX_ENV_KEYS.map((name) => [name, Boolean(process.env[name]?.trim())]),
  ) as Record<(typeof REQUIRED_AIRWALLEX_ENV_KEYS)[number], boolean>;

  const optional = Object.fromEntries(
    OPTIONAL_AIRWALLEX_ENV_KEYS.map((name) => [name, Boolean(process.env[name]?.trim())]),
  ) as Record<(typeof OPTIONAL_AIRWALLEX_ENV_KEYS)[number], boolean>;

  return {
    airwallex: {
      AIRWALLEX_API_KEY: required.AIRWALLEX_API_KEY,
      AIRWALLEX_CLIENT_ID: required.AIRWALLEX_CLIENT_ID,
      AIRWALLEX_ENVIRONMENT: optional.AIRWALLEX_ENVIRONMENT,
    },
    readyForCheckout: required.AIRWALLEX_API_KEY && required.AIRWALLEX_CLIENT_ID,
    readyForPayouts:
      required.AIRWALLEX_API_KEY &&
      required.AIRWALLEX_CLIENT_ID &&
      Boolean(optional.AIRWALLEX_ACCOUNT_ID),
    environment: resolveAirwallexEnvironment(),
  };
};

// =============================================================================
// Currency and Country Validation
// =============================================================================

export const normalizeCurrencyCode = (value: string | undefined, fieldName: string): string => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid 3-letter currency code`);
  }
  return normalized;
};

export const normalizeIsoCountryCode = (value: string | undefined, fieldName: string): string => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid 2-letter country code`);
  }
  return normalized;
};

// =============================================================================
// Supported Countries and Currencies
// =============================================================================

export const AIRWALLEX_SUPPORTED_COUNTRIES = [
  "AU",
  "CN",
  "HK",
  "ID",
  "JP",
  "KR",
  "MY",
  "NZ",
  "PH",
  "SG",
  "TH",
  "TW",
  "VN", // APAC
  "US", // Americas
  "AT",
  "BE",
  "DK",
  "FI",
  "FR",
  "DE",
  "IE",
  "IT",
  "NL",
  "NO",
  "PT",
  "ES",
  "SE",
  "CH",
  "GB", // EMEA
  "IL", // Middle East
] as const;

export const AIRWALLEX_SUPPORTED_CURRENCIES = [
  "AUD",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "IDR",
  "JPY",
  "KRW",
  "MYR",
  "NZD",
  "PHP",
  "SGD",
  "THB",
  "TWD",
  "USD",
  "VND",
  "ILS",
] as const;

// =============================================================================
// Configuration Export
// =============================================================================

import type { PaymentProviderConfig } from "../payment_provider";

export const airwallexProviderConfig: PaymentProviderConfig = {
  id: "airwallex",
  displayName: "Airwallex",
  supportedCountries: AIRWALLEX_SUPPORTED_COUNTRIES,
  supportedCurrencies: AIRWALLEX_SUPPORTED_CURRENCIES,
  webhookSignatureAlgo: "HMAC-SHA256",
};
