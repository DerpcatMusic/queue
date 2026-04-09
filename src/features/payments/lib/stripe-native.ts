import { Platform } from "react-native";
import { omitUndefined } from "@/lib/omit-undefined";
import {
  STRIPE_MERCHANT_DISPLAY_NAME,
  STRIPE_RETURN_URL,
  STRIPE_URL_SCHEME,
  getStripePublishableKey,
} from "@/lib/stripe";

type StripeSdkModule = typeof import("@stripe/stripe-react-native");

let sdkLoadPromise: Promise<StripeSdkModule> | null = null;
let sdkInitialized = false;
let initializedPublishableKey: string | null = null;

async function loadStripeSdk(): Promise<StripeSdkModule> {
  if (Platform.OS === "web") {
    throw new Error("Stripe native payments are not available on web");
  }
  if (!sdkLoadPromise) {
    sdkLoadPromise = import("@stripe/stripe-react-native");
  }
  return await sdkLoadPromise;
}

export async function ensureStripeNativeSdkInitialized(): Promise<void> {
  const publishableKey = getStripePublishableKey();
  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  if (sdkInitialized && initializedPublishableKey === publishableKey) {
    return;
  }

  const sdk = await loadStripeSdk();
  await sdk.initStripe({
    publishableKey,
    urlScheme: STRIPE_URL_SCHEME,
  });
  sdkInitialized = true;
  initializedPublishableKey = publishableKey;
}

export async function presentStripeNativePaymentSheet(input: {
  clientSecret: string;
  merchantDisplayName?: string;
  billingEmail?: string;
}): Promise<
  | { status: "success" }
  | { status: "canceled" }
  | { status: "failed"; error: string }
> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const { error: initError } = await sdk.initPaymentSheet({
    merchantDisplayName: input.merchantDisplayName ?? STRIPE_MERCHANT_DISPLAY_NAME,
    paymentIntentClientSecret: input.clientSecret,
    returnURL: STRIPE_RETURN_URL,
    allowsDelayedPaymentMethods: true,
    ...omitUndefined({
      defaultBillingDetails: input.billingEmail
        ? {
            email: input.billingEmail,
          }
        : undefined,
    }),
  });

  if (initError) {
    return {
      status: "failed",
      error: initError.localizedMessage ?? initError.message,
    };
  }

  const { error, didCancel } = await sdk.presentPaymentSheet();
  if (didCancel || error?.code === "Canceled") {
    return { status: "canceled" };
  }
  if (error) {
    return {
      status: "failed",
      error: error.localizedMessage ?? error.message,
    };
  }

  return { status: "success" };
}
