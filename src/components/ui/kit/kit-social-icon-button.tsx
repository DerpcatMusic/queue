import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Pressable, View } from "react-native";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, IconSize } from "@/lib/design-system";
import { triggerSelectionHaptic } from "./native-interaction";

type BrandIconName = "instagram" | "tiktok" | "whatsapp" | "facebook" | "linkedin";

type KitSocialIconButtonProps = {
  accessibilityLabel: string;
  icon: BrandIconName | "website";
  onPress?: () => void;
  active?: boolean;
  size?: number;
};

export function KitSocialIconButton({
  accessibilityLabel,
  icon,
  onPress,
  active = true,
  size = BrandSpacing.iconContainer,
}: KitSocialIconButtonProps) {
  const { color: palette } = useTheme();
  const iconSize = Math.max(IconSize.xs, Math.round(size * 0.44));
  const backgroundColor = active ? palette.primarySubtle : palette.surfaceAlt;
  const pressedBackgroundColor = active ? palette.primary : palette.surface;
  const tintColor = active ? palette.primary : palette.textMuted;

  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: BrandRadius.full,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: BorderWidth.hairline,
        borderColor: palette.border,
        backgroundColor,
      }}
    >
      {icon === "website" ? (
        <AppSymbol name="globe" size={iconSize} tintColor={tintColor} />
      ) : (
        <FontAwesome5 name={icon} size={iconSize} color={tintColor} />
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
        borderRadius: BrandRadius.full,
        backgroundColor: pressed ? pressedBackgroundColor : backgroundColor,
      })}
    >
      {circle}
    </Pressable>
  );
}
