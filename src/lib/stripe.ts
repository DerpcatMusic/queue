function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getStripeMarketDefaults() {
  const country = (trimEnv(process.env.EXPO_PUBLIC_STRIPE_CONNECTED_ACCOUNT_COUNTRY) ?? "DE").toUpperCase();
  const currency = (trimEnv(process.env.EXPO_PUBLIC_PAYMENTS_CURRENCY) ?? "EUR").toUpperCase();
  return { country, currency };
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
