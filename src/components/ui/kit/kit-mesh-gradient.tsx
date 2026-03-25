import { useMemo } from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import type { MeshGradientPreset } from "@/constants/brand";
import { BrandMeshGradient } from "@/constants/brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type MeshGradientViewProps = ViewProps & {
  preset?: MeshGradientPreset;
  /** Border radius. Defaults to 0 (none). */
  borderRadius?: number;
  /** If true, renders as Pressable with solid pressed feedback */
  pressable?: boolean;
  darkVariant?: boolean;
};

/**
 * MeshGradientView
 *
 * Renders a solid semantic surface that preserves the mesh API without alpha effects.
 */
export function MeshGradientView({
  preset = "primary",
  borderRadius = 0,
  pressable = false,
  darkVariant = false,
  style,
  children,
  ...props
}: MeshGradientViewProps) {
  const { resolvedScheme } = useThemePreference();

  const { fill, pressedFill } = useMemo(() => {
    const scheme = darkVariant ? "dark" : resolvedScheme;
    return BrandMeshGradient[scheme][preset];
  }, [darkVariant, preset, resolvedScheme]);

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
        {({ pressed }) => (
          <View
            style={[
              styles.container,
              {
                borderRadius,
                backgroundColor: pressed ? pressedFill : fill,
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
