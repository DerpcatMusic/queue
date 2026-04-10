import { PlatformPay, PlatformPayButton } from "@stripe/stripe-react-native";
import { BrandRadius } from "@/constants/brand";

interface StripePlatformPayButtonProps {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function StripePlatformPayButton({
  onPress,
  accessibilityLabel,
  disabled,
}: StripePlatformPayButtonProps) {
  return (
    <PlatformPayButton
      onPress={onPress}
      type={PlatformPay.ButtonType.Buy}
      appearance={PlatformPay.ButtonStyle.Automatic}
      borderRadius={BrandRadius.medium}
      disabled={disabled ?? false}
      style={{
        height: 44,
        alignSelf: "stretch",
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
