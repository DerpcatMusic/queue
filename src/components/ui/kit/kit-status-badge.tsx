import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import type { KitStatusBadgeProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

export function KitStatusBadge({
  label,
  tone = "neutral",
  showDot = true,
  style,
}: KitStatusBadgeProps) {
  const { background, border, color, foreground } = useKitTheme();

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
            backgroundColor: background.surfaceSecondary,
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
                accent: border.secondary,
                backgroundColor: background.surface,
                text: foreground.muted,
              };

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: resolvedTone.accent,
          backgroundColor: resolvedTone.backgroundColor,
        },
        style,
      ]}
    >
      {showDot ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
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
