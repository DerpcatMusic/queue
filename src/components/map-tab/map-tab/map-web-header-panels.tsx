import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { ActionButton } from "@/components/ui/action-button";
import { type BrandPalette, BrandType } from "@/constants/brand";

type MapWebHeaderPanelsProps = {
  t: TFunction;
  palette: BrandPalette;
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
  palette,
  hasChanges,
  pendingChangeCount,
  persistedZoneCount,
  focusedZoneLabel,
  isSaving,
  onSave,
  onReset,
}: MapWebHeaderPanelsProps) {
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 30,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt as string,
          paddingHorizontal: 18,
          paddingVertical: 18,
          gap: 6,
        }}
      >
        <Text
          style={{
            ...BrandType.micro,
            color: palette.primary as string,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.workspaceEyebrow")}
        </Text>
        <Text
          style={{
            fontFamily: "BarlowCondensed_800ExtraBold",
            fontSize: 42,
            lineHeight: 38,
            letterSpacing: -1,
            color: palette.text as string,
          }}
        >
          {t("mapTab.web.workspaceTitle")}
        </Text>
        <Text
          style={{
            ...BrandType.body,
            color: palette.textMuted as string,
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
          backgroundColor: palette.primaryPressed as string,
          paddingHorizontal: 18,
          paddingVertical: 18,
          gap: 8,
        }}
      >
        <Text
          style={{
            ...BrandType.micro,
            color: palette.onPrimary as string,
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
            color: palette.onPrimary as string,
          }}
        >
          {hasChanges
            ? t("mapTab.web.stateStaged", { count: pendingChangeCount })
            : t("mapTab.web.stateLive")}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: palette.onPrimary as string,
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
              backgroundColor: palette.surface as string,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 2,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.textMuted as string,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t("mapTab.web.liveZones")}
            </Text>
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: palette.onPrimary as string,
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
              backgroundColor: palette.surface as string,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 2,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.textMuted as string,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t("mapTab.web.focus")}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.bodyStrong,
                color: palette.onPrimary as string,
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
            palette={palette}
            tone="secondary"
          />
          <ActionButton
            label={t("mapTab.web.resetToLive")}
            onPress={onReset}
            disabled={!hasChanges || isSaving}
            palette={palette}
            tone="secondary"
          />
        </View>
      </View>
    </View>
  );
}
