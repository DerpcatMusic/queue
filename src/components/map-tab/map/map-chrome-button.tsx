import { Pressable } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandRadius, BrandSpacing } from "@/constants/brand";

const MAP_ACTION_BUTTON_SIZE = BrandSpacing.xxl + BrandSpacing.xl;

type MapChromeButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
  palette: BrandPalette;
  active?: boolean;
  disabled?: boolean;
};

export function MapChromeButton({
  icon,
  label,
  onPress,
  palette,
  active = false,
  disabled = false,
}: MapChromeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: MAP_ACTION_BUTTON_SIZE,
        height: MAP_ACTION_BUTTON_SIZE,
        borderRadius: BrandRadius.button,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? (palette.primary as string) : (palette.surfaceElevated as string),
        borderWidth: 1.5,
        borderColor: active ? (palette.primary as string) : (palette.borderStrong as string),
        opacity: disabled ? 0.48 : pressed ? 0.86 : 1,
      })}
    >
      <IconSymbol
        name={icon as never}
        size={20}
        color={active ? (palette.onPrimary as string) : (palette.text as string)}
      />
    </Pressable>
  );
}
