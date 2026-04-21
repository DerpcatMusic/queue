import { Platform } from "react-native";
import { omitUndefined } from "@/lib/omit-undefined";
import {
  getStripePublishableKey,
  STRIPE_MERCHANT_DISPLAY_NAME,
  STRIPE_RETURN_URL,
  STRIPE_URL_SCHEME,
} from "@/lib/stripe";
import { getPaymentMethodOrder } from "./get-payment-method-order";

type StripeSdkModule = typeof import("@stripe/stripe-react-native");
type StripeInitPaymentSheetParams = Parameters<StripeSdkModule["initPaymentSheet"]>[0];

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

function toMajorCurrencyAmount(minorUnits: number) {
  return (minorUnits / 100).toFixed(2);
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
  customerId?: string;
  paymentMethodOrder?: string[];
  merchantCountryCode?: string;
  currencyCode?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const initPaymentSheetParams: Parameters<typeof sdk.initPaymentSheet>[0] = {
    merchantDisplayName: input.merchantDisplayName ?? STRIPE_MERCHANT_DISPLAY_NAME,
    paymentIntentClientSecret: input.clientSecret,
    returnURL: STRIPE_RETURN_URL,
    allowsDelayedPaymentMethods: true,
    paymentMethodOrder:
      input.paymentMethodOrder ?? getPaymentMethodOrder(input.currencyCode ?? "EUR"),
    ...omitUndefined({
      defaultBillingDetails: input.billingEmail
        ? {
            email: input.billingEmail,
          }
        : undefined,
    }),
  };

  if (input.merchantCountryCode && Platform.OS === "ios") {
    initPaymentSheetParams.applePay = {
      merchantCountryCode: input.merchantCountryCode,
    };
  }

  if (input.merchantCountryCode && Platform.OS === "android" && input.currencyCode) {
    initPaymentSheetParams.googlePay = {
      merchantCountryCode: input.merchantCountryCode,
      currencyCode: input.currencyCode,
      testEnv: __DEV__,
    };
  }

  if (input.customerId) {
    initPaymentSheetParams.customerId = input.customerId;
  }

  const { error: initError } = await sdk.initPaymentSheet(initPaymentSheetParams);

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

export async function presentStripeNativeCardSetup(input: {
  setupIntentClientSecret: string;
  billingName: string;
  billingEmail?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const tokenResult = await sdk.createToken({
    type: "Card",
    name: input.billingName,
  });
  if (tokenResult.error) {
    if ((tokenResult.error as { code?: string }).code === "Canceled") {
      return { status: "canceled" };
    }
    return {
      status: "failed",
      error: tokenResult.error.localizedMessage ?? tokenResult.error.message,
    };
  }

  const confirmResult = await sdk.confirmSetupIntent(input.setupIntentClientSecret, {
    paymentMethodType: "Card",
    paymentMethodData: {
      token: tokenResult.token.id,
      billingDetails: {
        name: input.billingName,
        ...(input.billingEmail ? { email: input.billingEmail } : {}),
      },
    },
  });

  if (confirmResult.error) {
    if (confirmResult.error.code === "Canceled") {
      return { status: "canceled" };
    }
    return {
      status: "failed",
      error: confirmResult.error.localizedMessage ?? confirmResult.error.message,
    };
  }

  const setupIntent = confirmResult.setupIntent;
  if (setupIntent.status === "RequiresAction") {
    const nextActionResult = await sdk.handleNextActionForSetup(
      input.setupIntentClientSecret,
      STRIPE_RETURN_URL,
    );
    if (nextActionResult.error) {
      if (nextActionResult.error.code === "Canceled") {
        return { status: "canceled" };
      }
      return {
        status: "failed",
        error: nextActionResult.error.localizedMessage ?? nextActionResult.error.message,
      };
    }
  }

  return { status: "success" };
}

export async function presentStripeNativeSetupSheet(input: {
  setupIntentClientSecret: string;
  customerSessionClientSecret?: string;
  customerId?: string;
  merchantDisplayName?: string;
  billingName?: string;
  billingEmail?: string;
  paymentMethodOrder?: string[];
  currencyCode?: string;
  appearance?: StripeInitPaymentSheetParams["appearance"];
  style?: StripeInitPaymentSheetParams["style"];
  billingDetailsCollectionConfiguration?: StripeInitPaymentSheetParams["billingDetailsCollectionConfiguration"];
  defaultBillingDetails?: StripeInitPaymentSheetParams["defaultBillingDetails"];
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const initPaymentSheetParams: StripeInitPaymentSheetParams = {
    merchantDisplayName: input.merchantDisplayName ?? STRIPE_MERCHANT_DISPLAY_NAME,
    setupIntentClientSecret: input.setupIntentClientSecret,
    returnURL: STRIPE_RETURN_URL,
    allowsDelayedPaymentMethods: true,
    paymentMethodOrder: input.paymentMethodOrder ?? getPaymentMethodOrder(input.currencyCode ?? "EUR"),
    ...omitUndefined({
      customerId: input.customerId,
      customerSessionClientSecret: input.customerSessionClientSecret,
      style: input.style,
      appearance: input.appearance,
      defaultBillingDetails:
        input.defaultBillingDetails ??
        (input.billingName || input.billingEmail
          ? {
              ...(input.billingName ? { name: input.billingName } : {}),
              ...(input.billingEmail ? { email: input.billingEmail } : {}),
            }
          : undefined),
      billingDetailsCollectionConfiguration: input.billingDetailsCollectionConfiguration,
    }),
  };

  const { error: initError } = await sdk.initPaymentSheet(initPaymentSheetParams);
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

export async function presentStripeNativeBankPayment(input: {
  clientSecret: string;
  billingName: string;
  billingEmail?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const { error, paymentIntent } = await sdk.collectBankAccountForPayment(input.clientSecret, {
    paymentMethodType: "USBankAccount",
    paymentMethodData: {
      billingDetails: {
        name: input.billingName,
        ...(input.billingEmail ? { email: input.billingEmail } : {}),
      },
    },
  });

  if (error) {
    if (error.code === "Canceled") {
      return { status: "canceled" };
    }
    return {
      status: "failed",
      error: error.localizedMessage ?? error.message,
    };
  }

  if (!paymentIntent?.status) {
    return {
      status: "failed",
      error: "Stripe did not return a confirmed bank payment intent",
    };
  }

  return { status: "success" };
}

export async function presentStripeNativePlatformPayPayment(input: {
  clientSecret: string;
  merchantCountryCode: string;
  currencyCode: string;
  amountAgorot: number;
  merchantName?: string;
  label?: string;
}): Promise<{ status: "success" } | { status: "canceled" } | { status: "failed"; error: string }> {
  const sdk = await loadStripeSdk();
  await ensureStripeNativeSdkInitialized();

  const amount = toMajorCurrencyAmount(input.amountAgorot);
  const paymentParams =
    Platform.OS === "ios"
      ? {
          applePay: {
            merchantCountryCode: input.merchantCountryCode,
            currencyCode: input.currencyCode,
            cartItems: [
              {
                label: input.label ?? STRIPE_MERCHANT_DISPLAY_NAME,
                amount,
              },
            ],
          },
        }
      : {
          googlePay: {
            testEnv: __DEV__,
            merchantCountryCode: input.merchantCountryCode,
            currencyCode: input.currencyCode,
            merchantName: input.merchantName ?? STRIPE_MERCHANT_DISPLAY_NAME,
            amount: input.amountAgorot,
            label: input.label ?? STRIPE_MERCHANT_DISPLAY_NAME,
          },
        };

  const { error, paymentIntent } = await sdk.confirmPlatformPayPayment(
    input.clientSecret,
    paymentParams as any,
  );

  if (error) {
    if (error.code === "Canceled") {
      return { status: "canceled" };
    }
    return {
      status: "failed",
      error: error.localizedMessage ?? error.message,
    };
  }

  if (!paymentIntent?.status) {
    return {
      status: "failed",
      error: "Stripe did not return a confirmed platform pay intent",
    };
  }

  return { status: "success" };
}
