function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getStripeMarketDefaults() {
  const country = (trimEnv(process.env.STRIPE_CONNECTED_ACCOUNT_COUNTRY) ?? "DE").toUpperCase();
  const currency = (trimEnv(process.env.PAYMENTS_CURRENCY) ?? "EUR").toUpperCase();
  return { country, currency };
}

export function getStripeEnvPresence() {
  const required = {
    STRIPE_SECRET_KEY: Boolean(trimEnv(process.env.STRIPE_SECRET_KEY)),
    STRIPE_WEBHOOK_SECRET: Boolean(trimEnv(process.env.STRIPE_WEBHOOK_SECRET)),
    STRIPE_CONNECT_WEBHOOK_SECRET: Boolean(trimEnv(process.env.STRIPE_CONNECT_WEBHOOK_SECRET)),
  };

  return {
    stripe: required,
    readyForCheckout: required.STRIPE_SECRET_KEY,
    readyForWebhooks:
      required.STRIPE_SECRET_KEY &&
      required.STRIPE_WEBHOOK_SECRET &&
      required.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
}
