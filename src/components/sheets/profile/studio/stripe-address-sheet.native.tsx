import { AddressSheet } from "@stripe/stripe-react-native";
import type { ComponentProps } from "react";

export function StripeAddressSheet(props: ComponentProps<typeof AddressSheet>) {
  return <AddressSheet {...props} />;
}
