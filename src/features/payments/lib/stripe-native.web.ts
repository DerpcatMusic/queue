export async function ensureStripeNativeSdkInitialized(): Promise<void> {
  throw new Error("Stripe native payments are not available on web");
}

export async function presentStripeNativePaymentSheet(_input?: {
  clientSecret: string;
  merchantDisplayName?: string;
  billingEmail?: string;
  customerId?: string;
  paymentMethodOrder?: string[];
  merchantCountryCode?: string;
  currencyCode?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  return {
    status: "failed",
    error: "Stripe native payments are not available on web",
  };
}

export async function presentStripeNativeCardSetup(_input?: {
  setupIntentClientSecret: string;
  billingName: string;
  billingEmail?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  return {
    status: "failed",
    error: "Stripe native card setup is not available on web",
  };
}

export async function presentStripeNativeSetupSheet(_input?: {
  setupIntentClientSecret: string;
  customerSessionClientSecret?: string;
  customerId?: string;
  merchantDisplayName?: string;
  billingName?: string;
  billingEmail?: string;
  paymentMethodOrder?: string[];
  currencyCode?: string;
  appearance?: unknown;
  style?: unknown;
  billingDetailsCollectionConfiguration?: unknown;
  defaultBillingDetails?: unknown;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  return {
    status: "failed",
    error: "Stripe native setup sheets are not available on web",
  };
}

export async function presentStripeNativeBankPayment(_input?: {
  clientSecret: string;
  billingName: string;
  billingEmail?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  return {
    status: "failed",
    error: "Stripe native bank payments are not available on web",
  };
}

export async function presentStripeNativePlatformPayPayment(_input?: {
  clientSecret: string;
  merchantCountryCode: string;
  currencyCode: string;
  amountAgorot: number;
  merchantName?: string;
  label?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  return {
    status: "failed",
    error: "Stripe native platform pay is not available on web",
  };
}

export { getPaymentMethodOrder } from "./get-payment-method-order";
