import type {
  AirwallexPaymentResultStatus,
  AirwallexPaymentSession,
  AirwallexSdkEnvironment,
} from "airwallex-payment-react-native";
import { Platform } from "react-native";

type AirwallexSdkModule = typeof import("airwallex-payment-react-native");

let sdkLoadPromise: Promise<AirwallexSdkModule> | null = null;
let sdkInitialized = false;
let initializedEnvironment: AirwallexSdkEnvironment | null = null;

async function loadAirwallexSdk(): Promise<AirwallexSdkModule> {
  if (Platform.OS === "web") {
    throw new Error("Airwallex native checkout is not available on web");
  }
  if (!sdkLoadPromise) {
    sdkLoadPromise = import("airwallex-payment-react-native");
  }
  return await sdkLoadPromise;
}

export async function ensureAirwallexNativeSdkInitialized(input?: {
  environment?: AirwallexSdkEnvironment;
  enableLogging?: boolean;
  saveLogToLocal?: boolean;
}): Promise<void> {
  const environment = input?.environment ?? "demo";
  if (sdkInitialized && initializedEnvironment === environment) {
    return;
  }
  const sdk = await loadAirwallexSdk();
  sdk.initialize(environment, input?.enableLogging ?? __DEV__, input?.saveLogToLocal ?? false);
  sdkInitialized = true;
  initializedEnvironment = environment;
}

export async function presentAirwallexNativePaymentFlow(
  session: AirwallexPaymentSession,
  input?: {
    environment?: AirwallexSdkEnvironment;
  },
): Promise<{
  status: AirwallexPaymentResultStatus;
  error?: string;
}> {
  const sdk = await loadAirwallexSdk();
  await ensureAirwallexNativeSdkInitialized(input);
  return await sdk.presentEntirePaymentFlow(session);
}

export function buildAirwallexNativePaymentSession(input: {
  paymentIntentId: string;
  clientSecret: string;
  amountAgorot: number;
  currency: string;
  countryCode: string;
  customerId?: string;
  paymentMethods?: string[];
}): AirwallexPaymentSession {
  return {
    type: "OneOff",
    paymentIntentId: input.paymentIntentId,
    clientSecret: input.clientSecret,
    amount: Number((input.amountAgorot / 100).toFixed(2)),
    currency: input.currency,
    countryCode: input.countryCode,
    isBillingRequired: false,
    paymentMethods: input.paymentMethods ?? ["card"],
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };
}
