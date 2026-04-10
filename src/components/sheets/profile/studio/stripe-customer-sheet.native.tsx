import { CustomerSheet } from "@stripe/stripe-react-native";

type StripeCustomerSheetResult = {
  error?: {
    localizedMessage?: string;
    message: string;
  };
  paymentOption?: unknown;
  paymentMethod?: unknown;
};

type StripeCustomerSheetProps = {
  visible: boolean;
  onResult: (result: StripeCustomerSheetResult) => void;
  merchantDisplayName?: string;
  headerTextForSelectionScreen?: string;
  intentConfiguration?: unknown;
  clientSecretProvider?: unknown;
  defaultBillingDetails?: unknown;
  billingDetailsCollectionConfiguration?: {
    name?: "automatic" | "never" | "always";
    email?: "automatic" | "never" | "always";
    address?: "automatic" | "never" | "full";
    attachDefaultsToPaymentMethod?: boolean;
  };
  returnURL?: string;
  applePayEnabled?: boolean;
  googlePayEnabled?: boolean;
};

export function StripeCustomerSheet(props: StripeCustomerSheetProps) {
  return <CustomerSheet.Component {...(props as any)} />;
}
