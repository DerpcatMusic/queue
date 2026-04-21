function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const STRIPE_BILLING_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export function getStripeMarketDefaults() {
  const country = (
    trimEnv(process.env.EXPO_PUBLIC_STRIPE_CONNECTED_ACCOUNT_COUNTRY) ?? "DE"
  ).toUpperCase();
  const currency = (trimEnv(process.env.EXPO_PUBLIC_PAYMENTS_CURRENCY) ?? "EUR").toUpperCase();
  return { country, currency };
}

export function getStripeSetupCountry(preferredCountry?: string | null) {
  const marketCountry = getStripeMarketDefaults().country;
  const normalizedPreferred = preferredCountry?.trim().toUpperCase();

  if (!normalizedPreferred) {
    return marketCountry;
  }

  return STRIPE_BILLING_COUNTRIES.has(normalizedPreferred) ? normalizedPreferred : marketCountry;
}

export const STRIPE_URL_SCHEME = "queue";
export const STRIPE_RETURN_URL = `${STRIPE_URL_SCHEME}://stripe-redirect`;
export const STRIPE_CONNECT_RETURN_URL =
  trimEnv(process.env.EXPO_PUBLIC_STRIPE_CONNECT_RETURN_URL) ??
  "https://curious-stingray-854.convex.site/stripe/connect-return";
export const STRIPE_CONNECT_REFRESH_URL =
  trimEnv(process.env.EXPO_PUBLIC_STRIPE_CONNECT_REFRESH_URL) ??
  "https://curious-stingray-854.convex.site/stripe/connect-refresh";
export const STRIPE_MERCHANT_DISPLAY_NAME = "Queue";

export function getStripePublishableKey() {
  return trimEnv(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ?? null;
}

export function isStripeConfigured() {
  return Boolean(getStripePublishableKey());
}
