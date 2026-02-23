import type { ReactNode } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useKitTheme } from "./use-kit-theme";

type KitHeaderProps = {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  rightAccessory?: ReactNode;
  compact?: boolean;
};

export function KitHeader({
  title,
  subtitle,
  badgeLabel,
  rightAccessory,
  compact = false,
}: KitHeaderProps) {
  const { foreground, border, background } = useKitTheme();

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: compact ? 12 : 16,
        paddingBottom: compact ? 8 : 10,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type={compact ? "subtitle" : "title"}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: foreground.muted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {badgeLabel ? (
          <View
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: border.primary,
              backgroundColor: background.surfaceSecondary,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <ThemedText
              type="micro"
              style={{
                color: foreground.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {badgeLabel}
            </ThemedText>
          </View>
        ) : null}
        {rightAccessory}
      </View>
    </View>
  );
}
