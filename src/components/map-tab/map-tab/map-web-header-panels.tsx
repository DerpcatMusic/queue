import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { ActionButton } from "@/components/ui/action-button";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

// Map web header panels - shares radii with command panel
const PANEL_RADIUS = BrandRadius.card + BrandSpacing.xs; // 24 + 4 = 28px
const INNER_RADIUS = BrandRadius.cardSubtle; // 18px

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
    <View style={{ flexDirection: "row", gap: BrandSpacing.lg }}>
      <View
        style={{
          flex: 1,
          borderRadius: PANEL_RADIUS,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt as string,
          paddingHorizontal: BrandSpacing.lg + 2,
          paddingVertical: BrandSpacing.lg + 2,
          gap: BrandSpacing.xs,
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
            ...BrandType.display,
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
          borderRadius: PANEL_RADIUS,
          borderCurve: "continuous",
          backgroundColor: palette.primary as string,
          paddingHorizontal: BrandSpacing.lg + 2,
          paddingVertical: BrandSpacing.lg + 2,
          gap: BrandSpacing.sm,
        }}
      >
        <Text
          style={{
            ...BrandType.micro,
            color: palette.onPrimary as string,
            opacity: 0.78,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.stateEyebrow")}
        </Text>
        <Text
          style={{
            ...BrandType.heroSmall,
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
            opacity: 0.86,
          }}
        >
          {hasChanges ? t("mapTab.web.statePending") : t("mapTab.web.stateReady")}
        </Text>
        <View style={{ flexDirection: "row", gap: BrandSpacing.sm, marginTop: BrandSpacing.xs }}>
          <View
            style={{
              flex: 1,
              borderRadius: INNER_RADIUS,
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.14)",
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.sm,
              gap: 2,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.onPrimary as string,
                opacity: 0.72,
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
              borderRadius: INNER_RADIUS,
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.14)",
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.sm,
              gap: 2,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.onPrimary as string,
                opacity: 0.72,
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
        <View style={{ flexDirection: "row", gap: BrandSpacing.sm, marginTop: "auto" }}>
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
