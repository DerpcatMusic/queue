import { useMemo } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import type { MeshGradientPreset } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type MeshGradientViewProps = ViewProps & {
  /** Which mesh gradient preset to use */
  preset?: MeshGradientPreset;
  /** Retained for API compatibility; no visual grain is rendered. */
  grainOpacity?: number;
  /** Border radius. Defaults to 0 (none). */
  borderRadius?: number;
  /** If true, renders as Pressable with solid pressed feedback */
  pressable?: boolean;
  /** If true, uses dark variant (for light/dark independent control) */
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
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();

  const surfaceColor = useMemo(() => {
    const scheme = darkVariant ? "dark" : resolvedScheme;
    return preset === "primaryDark"
      ? scheme === "dark"
        ? (palette.primaryPressed as string)
        : (palette.primaryPressed as string)
      : (palette.primary as string);
  }, [darkVariant, palette.primary, palette.primaryPressed, preset, resolvedScheme]);
  const pressedSurfaceColor =
    preset === "primaryDark" ? (palette.primary as string) : (palette.primaryPressed as string);

  const containerStyle = useMemo(
    () => [
      {
        borderRadius,
        overflow: "hidden" as const,
        backgroundColor: surfaceColor,
      },
      style,
    ],
    [borderRadius, style, surfaceColor],
  );

  if (pressable) {
    return (
      <Pressable {...props} style={containerStyle}>
        {({ pressed }) => (
          <View
            style={{
              borderRadius,
              backgroundColor: pressed ? pressedSurfaceColor : surfaceColor,
            }}
          >
            {children}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View {...props} style={containerStyle}>
      {children}
    </View>
  );
}
