import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import type { KitStatusBadgeProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

export function KitStatusBadge({
  label,
  tone = "neutral",
  showDot = true,
  style,
}: KitStatusBadgeProps) {
  const { background, color, foreground } = useKitTheme();

  const resolvedTone =
    tone === "success"
      ? {
          accent: color.success,
          backgroundColor: background.primarySubtle,
          text: color.success,
        }
      : tone === "warning"
        ? {
            accent: color.warning,
            backgroundColor: background.surfaceElevated,
            text: color.warning,
          }
        : tone === "danger"
          ? {
              accent: color.danger,
              backgroundColor: background.dangerSubtle,
              text: color.danger,
            }
          : tone === "accent"
            ? {
                accent: color.primary,
                backgroundColor: background.primarySubtle,
                text: foreground.secondary,
              }
            : {
                accent: foreground.muted,
                backgroundColor: background.surfaceElevated,
                text: foreground.muted,
              };

  return (
    <View
      className="flex-row items-center rounded-full"
      style={[
        {
          gap: BrandSpacing.stackMicro,
          paddingHorizontal: BrandSpacing.stackDense,
          paddingVertical: BrandSpacing.stackMicro,
          backgroundColor: resolvedTone.backgroundColor,
          borderCurve: "continuous",
        },
        style,
      ]}
    >
      {showDot ? (
        <View
          style={{
            width: BrandSpacing.statusDotBadge,
            height: BrandSpacing.statusDotBadge,
            borderRadius: BrandRadius.pill,
            backgroundColor: resolvedTone.accent,
          }}
        />
      ) : null}
      <ThemedText type="micro" style={{ color: resolvedTone.text }}>
        {label}
      </ThemedText>
    </View>
  );
}
