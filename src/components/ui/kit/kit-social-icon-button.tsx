import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Pressable, View } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { type BrandPalette, BrandRadius, BrandSpacing } from "@/constants/brand";
import { triggerSelectionHaptic } from "./native-interaction";

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
  size = BrandSpacing.controlSm - BrandSpacing.xxs,
}: KitSocialIconButtonProps) {
  const iconSize = Math.max(BrandSpacing.md + BrandSpacing.xxs, Math.round(size * 0.44));
  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: BrandRadius.pill,
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => ({
        borderRadius: BrandRadius.pill,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      {circle}
    </Pressable>
  );
}
