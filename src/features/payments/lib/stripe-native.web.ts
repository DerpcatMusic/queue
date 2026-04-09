export async function ensureStripeNativeSdkInitialized(): Promise<void> {
  throw new Error("Stripe native payments are not available on web");
}

export async function presentStripeNativePaymentSheet(): Promise<
  | { status: "success" }
  | { status: "canceled" }
  | { status: "failed"; error: string }
> {
  return {
    status: "failed",
    error: "Stripe native payments are not available on web",
  };
}
