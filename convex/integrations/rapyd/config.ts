import { ConvexError } from "convex/values";

export type RapydMode = "sandbox" | "production";
export type RapydSignatureEncoding = "hex_base64" | "raw_base64";

const REQUIRED_RAPYD_ENV_KEYS = [
  "RAPYD_ACCESS_KEY",
  "RAPYD_SECRET_KEY",
  "RAPYD_COUNTRY",
  "RAPYD_COMPLETE_CHECKOUT_URL",
  "RAPYD_CANCEL_CHECKOUT_URL",
  "RAPYD_EWALLET",
] as const;

const OPTIONAL_RAPYD_ONBOARDING_ENV_KEYS = [
  "RAPYD_BENEFICIARY_COMPLETE_URL",
  "RAPYD_BENEFICIARY_CANCEL_URL",
  "RAPYD_WEBHOOK_SECRET",
  "RAPYD_PAYMENT_METHODS",
  "RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE",
  "RAPYD_BASE_URL",
  "RAPYD_SANDBOX_BASE_URL",
  "RAPYD_PROD_BASE_URL",
] as const;

type RapydEnvPresenceMap<T extends readonly string[]> = Record<T[number], boolean>;

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

export const resolveRapydMode = (): RapydMode =>
  (process.env.RAPYD_MODE ?? "sandbox").trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";

export const resolvePreferredRapydSignatureEncoding = (): RapydSignatureEncoding =>
  (process.env.RAPYD_SIGNATURE_ENCODING ?? "hex_base64").trim().toLowerCase() === "raw_base64"
    ? "raw_base64"
    : "hex_base64";

export const normalizeRapydBaseUrl = (rawValue: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new ConvexError("Rapyd base URL must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:") {
    throw new ConvexError("Rapyd base URL must use https");
  }
  if (parsed.username || parsed.password) {
    throw new ConvexError("Rapyd base URL must not include credentials");
  }
  if (parsed.search || parsed.hash) {
    throw new ConvexError("Rapyd base URL must not include query or hash");
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path === "/" ? "" : path}`;
};

export const resolveRapydBaseUrl = (): string => {
  const mode = resolveRapydMode();
  return normalizeRapydBaseUrl(
    mode === "production"
      ? (process.env.RAPYD_PROD_BASE_URL ?? process.env.RAPYD_BASE_URL ?? "https://api.rapyd.net")
      : (process.env.RAPYD_SANDBOX_BASE_URL ??
          process.env.RAPYD_BASE_URL ??
          "https://sandboxapi.rapyd.net"),
  );
};

export const normalizeHostedPageUrl = (rawUrl: string, fieldName: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ConvexError(`${fieldName} must be a valid absolute URL`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new ConvexError(`${fieldName} must use http or https`);
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocalHost) {
    throw new ConvexError(`${fieldName} cannot use localhost`);
  }

  return parsed.toString();
};

export const resolveHostedPageUrl = ({
  provided,
  envName,
  fieldName,
}: {
  provided: string | undefined;
  envName: string;
  fieldName: string;
}): string => {
  const raw = (provided?.trim() || process.env[envName]?.trim() || "").trim();
  if (!raw) {
    throw new ConvexError(
      `${fieldName} is required. Set ${envName} in Convex env to a public https URL.`,
    );
  }
  return normalizeHostedPageUrl(raw, fieldName);
};

export const normalizeIsoCountryCode = (value: string | undefined, fieldName: string): string => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid 2-letter country code`);
  }
  return normalized;
};

export const normalizeCurrencyCode = (value: string | undefined, fieldName: string): string => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid 3-letter currency code`);
  }
  return normalized;
};

export const normalizeRapydPayoutMethodType = (
  value: string | undefined,
  fieldName: string,
): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_:-]{2,64}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid Rapyd payout method type`);
  }
  return normalized;
};

export const normalizeRapydExternalRecipientId = (
  value: string | undefined,
  fieldName: string,
): string => {
  const normalized = (value ?? "").trim();
  if (!/^[A-Za-z0-9:._-]{3,160}$/.test(normalized)) {
    throw new ConvexError(`${fieldName} must be a valid Rapyd external recipient id`);
  }
  return normalized;
};

export const resolveRapydCountry = (value = process.env.RAPYD_COUNTRY ?? "IL"): string =>
  normalizeIsoCountryCode(value, "RAPYD_COUNTRY");

export const resolvePaymentsCurrency = (value = process.env.PAYMENTS_CURRENCY ?? "ILS"): string =>
  normalizeCurrencyCode(value, "PAYMENTS_CURRENCY");

export const getRapydEnvPresence = () => {
  const rapyd = Object.fromEntries(
    REQUIRED_RAPYD_ENV_KEYS.map((name) => [name, Boolean(process.env[name]?.trim())]),
  ) as RapydEnvPresenceMap<typeof REQUIRED_RAPYD_ENV_KEYS>;

  const rapydOptional = Object.fromEntries(
    OPTIONAL_RAPYD_ONBOARDING_ENV_KEYS.map((name) => [name, Boolean(process.env[name]?.trim())]),
  ) as RapydEnvPresenceMap<typeof OPTIONAL_RAPYD_ONBOARDING_ENV_KEYS>;

  const mode = resolveRapydMode();
  const effectiveBaseUrlEnvName =
    mode === "production"
      ? process.env.RAPYD_PROD_BASE_URL?.trim()
        ? "RAPYD_PROD_BASE_URL"
        : process.env.RAPYD_BASE_URL?.trim()
          ? "RAPYD_BASE_URL"
          : "default"
      : process.env.RAPYD_SANDBOX_BASE_URL?.trim()
        ? "RAPYD_SANDBOX_BASE_URL"
        : process.env.RAPYD_BASE_URL?.trim()
          ? "RAPYD_BASE_URL"
          : "default";

  return {
    rapyd,
    rapydOptional,
    mode,
    effectiveBaseUrlEnvName,
    hasExplicitWebhookSecret: rapydOptional.RAPYD_WEBHOOK_SECRET,
    readyForCheckout: Object.values(rapyd).every(Boolean),
    readyForOnboarding:
      rapyd.RAPYD_ACCESS_KEY &&
      rapyd.RAPYD_SECRET_KEY &&
      rapyd.RAPYD_COUNTRY &&
      rapydOptional.RAPYD_BENEFICIARY_COMPLETE_URL &&
      rapydOptional.RAPYD_BENEFICIARY_CANCEL_URL,
    readyForPayouts:
      rapyd.RAPYD_ACCESS_KEY &&
      rapyd.RAPYD_SECRET_KEY &&
      rapyd.RAPYD_COUNTRY &&
      rapyd.RAPYD_EWALLET,
  };
};
