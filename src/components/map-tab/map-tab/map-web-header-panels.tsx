import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { ActionButton } from "@/components/ui/action-button";
import { useTheme } from "@/hooks/use-theme";

type MapWebHeaderPanelsProps = {
  t: TFunction;
  hasChanges: boolean;
  pendingChangeCount: number;
  persistedZoneCount: number;
  focusedZoneLabel: string | null;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function MapWebHeaderPanels({
  t,
  hasChanges,
  pendingChangeCount,
  persistedZoneCount,
  focusedZoneLabel,
  isSaving,
  onSave,
  onReset,
}: MapWebHeaderPanelsProps) {
  const { color: palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 30,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt,
          paddingHorizontal: 18,
          paddingVertical: 18,
          gap: 6,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            fontSize: 12,
            fontWeight: "500",
            lineHeight: 16,
            color: palette.primary,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.workspaceEyebrow")}
        </Text>
        <Text
          style={{
            fontFamily: "Lexend_800ExtraBold",
            fontSize: 42,
            lineHeight: 38,
            letterSpacing: -1,
            color: palette.text,
          }}
        >
          {t("mapTab.web.workspaceTitle")}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 22,
            color: palette.textMuted,
          }}
        >
          {t("mapTab.web.workspaceBody")}
        </Text>
      </View>

      <View
        style={{
          width: 320,
          borderRadius: 30,
          borderCurve: "continuous",
          backgroundColor: palette.primaryPressed,
          paddingHorizontal: 18,
          paddingVertical: 18,
          gap: 8,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            fontSize: 12,
            fontWeight: "500",
            lineHeight: 16,
            color: palette.onPrimary,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.stateEyebrow")}
        </Text>
        <Text
          style={{
            fontFamily: "BarlowCondensed_800ExtraBold",
            fontSize: 34,
            lineHeight: 32,
            letterSpacing: -0.8,
            color: palette.onPrimary,
          }}
        >
          {hasChanges
            ? t("mapTab.web.stateStaged", { count: pendingChangeCount })
            : t("mapTab.web.stateLive")}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.onPrimary,
          }}
        >
          {hasChanges ? t("mapTab.web.statePending") : t("mapTab.web.stateReady")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: palette.surface,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 12,
                fontWeight: "500",
                lineHeight: 16,
                color: palette.textMuted,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t("mapTab.web.liveZones")}
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: 22,
                color: palette.onPrimary,
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(persistedZoneCount)}
            </Text>
          </View>
          <View
            style={{
              flex: 1.25,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: palette.surface,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 12,
                fontWeight: "500",
                lineHeight: 16,
                color: palette.textMuted,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t("mapTab.web.focus")}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: 22,
                color: palette.onPrimary,
              }}
            >
              {focusedZoneLabel
                ? t("mapTab.web.focusPinned", { zone: focusedZoneLabel })
                : t("mapTab.web.auto")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: "auto" }}>
          <ActionButton
            label={t("mapTab.web.saveCoverage")}
            onPress={onSave}
            disabled={!hasChanges || isSaving}
            loading={isSaving}
            tone="secondary"
          />
          <ActionButton
            label={t("mapTab.web.resetToLive")}
            onPress={onReset}
            disabled={!hasChanges || isSaving}
            tone="secondary"
          />
        </View>
      </View>
    </View>
  );
}
