import { useMemo } from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import type { MeshGradientPreset } from "@/constants/brand";
import { BrandMeshGradient } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type MeshGradientViewProps = ViewProps & {
  /** Which mesh gradient preset to use */
  preset?: MeshGradientPreset;
  /** Grain intensity multiplier (0-1). Defaults to preset value. */
  grainOpacity?: number;
  /** Border radius. Defaults to 0 (none). */
  borderRadius?: number;
  /** If true, renders as Pressable with opacity feedback */
  pressable?: boolean;
  /** If true, uses dark variant (for light/dark independent control) */
  darkVariant?: boolean;
};

type TexturedOverlayProps = {
  tintColor: string;
};

function TexturedOverlay({ tintColor }: TexturedOverlayProps) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="grain" patternUnits="userSpaceOnUse" width="4" height="4">
          <Rect x="0" y="0" width="1" height="1" fill={tintColor} opacity={0.12} />
          <Rect x="2" y="2" width="1" height="1" fill={tintColor} opacity={0.08} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#grain)" />
    </Svg>
  );
}

/**
 * MeshGradientView
 *
 * Renders a rich mesh gradient with subtle textured overlay.
 * Uses stacked radial gradients via `experimental_backgroundImage` (New Architecture).
 * Adds a repeating dot pattern for grain/texture feel.
 */
export function MeshGradientView({
  preset = "primary",
  grainOpacity,
  borderRadius = 0,
  pressable = false,
  darkVariant = false,
  style,
  children,
  ...props
}: MeshGradientViewProps) {
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();

  const { gradient, grainOpacity: defaultGrainOpacity } = useMemo(() => {
    const scheme = darkVariant ? "dark" : resolvedScheme;
    return BrandMeshGradient[scheme][preset];
  }, [resolvedScheme, preset, darkVariant]);

  const effectiveGrainOpacity = grainOpacity ?? defaultGrainOpacity;
  const tintColor = palette.onPrimary as string;

  const containerStyle = useMemo(
    () => [
      styles.base,
      {
        borderRadius,
        experimental_backgroundImage: gradient,
      },
      style,
    ],
    [borderRadius, gradient, style],
  );

  const content = (
    <View style={[styles.container, { borderRadius }]}>
      <View style={StyleSheet.absoluteFill}>{children}</View>
      <View
        style={[styles.textureOverlay, { opacity: effectiveGrainOpacity }]}
        pointerEvents="none"
      >
        <TexturedOverlay tintColor={tintColor} />
      </View>
    </View>
  );

  if (pressable) {
    return (
      <Pressable {...props} style={containerStyle}>
        {({ pressed }) => (
          <View style={[styles.container, { borderRadius }, pressed && styles.pressed]}>
            <View style={StyleSheet.absoluteFill}>{children}</View>
            <View
              style={[styles.textureOverlay, { opacity: effectiveGrainOpacity }]}
              pointerEvents="none"
            >
              <TexturedOverlay tintColor={tintColor} />
            </View>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View {...props} style={containerStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  pressed: {
    opacity: 0.92,
  },
});
