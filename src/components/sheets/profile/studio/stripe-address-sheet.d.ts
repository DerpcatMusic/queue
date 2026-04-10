import type { ComponentType } from "react";

export type StripeAddressSheetProps = {
  visible: boolean;
  sheetTitle?: string;
  primaryButtonTitle?: string;
  onSubmit: (result: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }) => void;
  onError: () => void;
};

export const StripeAddressSheet: ComponentType<StripeAddressSheetProps>;
