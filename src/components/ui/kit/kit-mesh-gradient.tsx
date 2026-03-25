import { useMemo } from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { getTheme } from "@/lib/design-system";

type MeshGradientPreset = "primary" | "primaryDark" | "warm" | "teal";

type MeshGradientViewProps = ViewProps & {
  preset?: MeshGradientPreset;
  borderRadius?: number;
  pressable?: boolean;
  darkVariant?: boolean;
};

function shiftHexColor(color: string, amount: number) {
  const value = color.startsWith("#") ? color.slice(1) : color;
  if (![3, 6].includes(value.length)) return color;
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : value;
  const next = [0, 2, 4]
    .map((offset) =>
      Math.max(0, Math.min(255, Number.parseInt(expanded.slice(offset, offset + 2), 16) + amount)),
    )
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return `#${next}`;
}

export function MeshGradientView({
  preset = "primary",
  borderRadius = 0,
  pressable = false,
  darkVariant = false,
  style,
  children,
  ...props
}: MeshGradientViewProps) {
  const theme = useTheme();

  const { fill, pressed } = useMemo(() => {
    const palette = darkVariant ? getTheme("dark").color : theme.color;
    switch (preset) {
      case "primary":
        return { fill: palette.primary, pressed: palette.primaryPressed };
      case "primaryDark":
        return { fill: palette.primaryPressed, pressed: palette.primary };
      case "warm":
        return { fill: palette.secondary, pressed: shiftHexColor(palette.secondary, -12) };
      case "teal":
        return { fill: palette.tertiary, pressed: shiftHexColor(palette.tertiary, -10) };
      default:
        return { fill: palette.primary, pressed: palette.primaryPressed };
    }
  }, [darkVariant, preset, theme.color]);

  const containerStyle = useMemo(
    () => [
      {
        borderRadius,
        backgroundColor: fill,
      },
      style,
    ],
    [borderRadius, fill, style],
  );

  if (pressable) {
    return (
      <Pressable {...props} style={containerStyle}>
        {({ pressed: isPressed }) => (
          <View
            style={[
              styles.container,
              {
                borderRadius,
                backgroundColor: isPressed ? pressed : fill,
              },
            ]}
          >
            {children}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View {...props} style={containerStyle}>
      <View style={[styles.container, { borderRadius, backgroundColor: fill }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  container: {
    flex: 1,
  },
});
