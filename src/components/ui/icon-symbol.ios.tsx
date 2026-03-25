import { SymbolView, type SymbolViewProps, type SymbolWeight } from "expo-symbols";
import type { OpaqueColorValue, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = "regular",
}: {
  name: SymbolViewProps["name"];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const { color: themeColor } = useTheme();
  const resolvedTintColor = typeof color === "string" ? color : themeColor.text;

  return (
    <SymbolView
      weight={weight}
      tintColor={resolvedTintColor}
      resizeMode="scaleAspectFit"
      name={name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
