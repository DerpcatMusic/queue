declare module "airwallex-payment-react-native" {
  export type AirwallexPaymentResultStatus = "success" | "inProgress" | "cancelled";
  export type AirwallexSdkEnvironment = "staging" | "demo" | "production";

  export type AirwallexPaymentSession = {
    type: "OneOff";
    customerId?: string;
    paymentIntentId: string;
    currency: string;
    countryCode: string;
    amount: number;
    isBillingRequired: boolean;
    paymentMethods?: string[];
    clientSecret: string;
  };

  export function initialize(
    environment?: AirwallexSdkEnvironment,
    enableLogging?: boolean,
    saveLogToLocal?: boolean,
  ): void;
  export function presentEntirePaymentFlow(
    session: AirwallexPaymentSession,
  ): Promise<{ status: AirwallexPaymentResultStatus; error?: string }>;
}
