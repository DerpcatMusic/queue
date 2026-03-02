import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { View } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import type { BrandPalette } from "@/constants/brand";
import { KitPressable } from "./kit-pressable";

type BrandIconName = "instagram" | "tiktok" | "whatsapp" | "facebook" | "linkedin";

type KitSocialIconButtonProps = {
  accessibilityLabel: string;
  icon: BrandIconName | "website";
  palette: BrandPalette;
  onPress?: () => void;
  active?: boolean;
  size?: number;
};

export function KitSocialIconButton({
  accessibilityLabel,
  icon,
  palette,
  onPress,
  active = true,
  size = 36,
}: KitSocialIconButtonProps) {
  const iconSize = Math.max(14, Math.round(size * 0.44));
  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: palette.border as string,
        backgroundColor: active
          ? (palette.primarySubtle as string)
          : (palette.surfaceAlt as string),
      }}
    >
      {icon === "website" ? (
        <AppSymbol
          name="globe"
          size={iconSize}
          tintColor={(active ? palette.primary : palette.textMuted) as string}
        />
      ) : (
        <FontAwesome5
          name={icon}
          size={iconSize}
          color={(active ? palette.primary : palette.textMuted) as string}
        />
      )}
    </View>
  );

  if (!onPress) {
    return circle;
  }

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      haptic="selection"
      style={{ borderRadius: 999 }}
    >
      {circle}
    </KitPressable>
  );
}
