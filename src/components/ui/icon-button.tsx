import { View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { AppButton } from "./app-button";
import { getSurfaceElevationStyle } from "./surface-elevation";

type IconButtonProps = {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "primary" | "secondary" | "primarySubtle";
  size?: number;
  disabled?: boolean;
  backgroundColorOverride?: string;
  floating?: boolean;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "secondary",
  size = BrandSpacing.iconButtonSize,
  disabled = false,
  backgroundColorOverride,
  floating = false,
}: IconButtonProps) {
  const theme = useTheme();
  const raisedStyle = floating
    ? getSurfaceElevationStyle("floating", theme.color.shadow)
    : undefined;

  const baseBackgroundColor =
    backgroundColorOverride ??
    (tone === "primary"
      ? theme.color.primary
      : tone === "primarySubtle"
        ? theme.color.primarySubtle
        : theme.color.surfaceAlt);

  const pressedBackgroundColor =
    tone === "primary" ? theme.color.primaryPressed : theme.color.surfaceElevated;

  const disabledBackgroundColor =
    tone === "primary" || tone === "primarySubtle"
      ? theme.color.primarySubtle
      : theme.color.surface;

  return (
    <View style={raisedStyle}>
      <AppButton
        accessibilityLabel={accessibilityLabel}
        colors={{
          backgroundColor: baseBackgroundColor,
          pressedBackgroundColor,
          disabledBackgroundColor,
        }}
        disabled={disabled}
        dimension={size}
        haptic={false}
        icon={<View>{icon}</View>}
        onPress={onPress}
        radius={BrandRadius.buttonSubtle}
        shape="square"
      />
    </View>
  );
}
