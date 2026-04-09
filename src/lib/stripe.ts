function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const STRIPE_URL_SCHEME = "queue";
export const STRIPE_RETURN_URL = `${STRIPE_URL_SCHEME}://stripe-redirect`;
export const STRIPE_CONNECT_RETURN_URL = `${STRIPE_URL_SCHEME}://stripe-connect-return`;
export const STRIPE_MERCHANT_DISPLAY_NAME = "Queue";

export function getStripePublishableKey() {
  return trimEnv(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ?? null;
}

export function isStripeConfigured() {
  return Boolean(getStripePublishableKey());
}
