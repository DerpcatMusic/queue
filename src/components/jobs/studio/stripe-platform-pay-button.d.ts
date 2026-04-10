import type { ComponentType } from "react";

export type StripePlatformPayButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export const StripePlatformPayButton: ComponentType<StripePlatformPayButtonProps>;
