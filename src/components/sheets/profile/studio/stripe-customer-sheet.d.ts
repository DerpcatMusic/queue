import type { ComponentType } from "react";

export type StripeCustomerSheetProps = {
  visible: boolean;
  onResult: (result: {
    error?: {
      localizedMessage?: string;
      message: string;
    };
    paymentOption?: unknown;
    paymentMethod?: unknown;
  }) => void;
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

export const StripeCustomerSheet: ComponentType<StripeCustomerSheetProps>;
