import type { TFunction } from "i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";

// Map web command panel - desktop-focused with fixed width panel
const PANEL_WIDTH = BrandSpacing.shellCommandPanel;
const PANEL_RADIUS = BrandRadius.soft;
const INNER_RADIUS = BrandRadius.medium;
const METRIC_RADIUS = BrandRadius.hard;
const TERRITORY_RADIUS = BrandRadius.hard;
const ZONE_SELECT_RADIUS = BrandRadius.hard;

type MapWebCommandPanelProps = {
  t: TFunction;
  palette: BrandPalette;
  zoneLanguage: "en" | "he";
  zoneSearch: string;
  selectedZones: ZoneOption[];
  filteredZones: ZoneOption[];
  focusZoneId: string | null;
  focusedZoneLabel: string | null;
  pendingChangeCount: number;
  saveError: string | null;
  onSearchChange: (text: string) => void;
  onSetFocusZone: (zoneId: string | null) => void;
  onToggleZone: (zoneId: string) => void;
};

export function MapWebCommandPanel({
  t,
  palette,
  zoneLanguage,
  zoneSearch,
  selectedZones,
  filteredZones,
  focusZoneId,
  focusedZoneLabel,
  pendingChangeCount,
  saveError,
  onSearchChange,
  onSetFocusZone,
  onToggleZone,
}: MapWebCommandPanelProps) {
  return (
    <View
      style={{
        width: PANEL_WIDTH,
        borderRadius: PANEL_RADIUS,
        borderCurve: "continuous",
        backgroundColor: palette.surfaceAlt as string,
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: BrandSpacing.lg,
        gap: BrandSpacing.lg,
      }}
    >
      <View style={{ gap: BrandSpacing.xs }}>
        <Text
          style={{
            ...BrandType.heading,
            color: palette.text as string,
          }}
        >
          {t("mapTab.web.commandEyebrow")}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
          }}
        >
          {t("mapTab.web.commandBody")}
        </Text>
      </View>

      <View
        style={{
          borderRadius: INNER_RADIUS,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
          paddingHorizontal: BrandSpacing.controlX,
          paddingVertical: BrandSpacing.controlY,
          gap: BrandSpacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
          <View
            style={{
              flex: 1,
              borderRadius: METRIC_RADIUS,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceAlt as string,
              paddingHorizontal: BrandSpacing.controlX,
              paddingVertical: BrandSpacing.sm,
              gap: BrandSpacing.xs,
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
              {t("mapTab.web.pending")}
            </Text>
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: palette.text as string,
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(pendingChangeCount)}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: METRIC_RADIUS,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceAlt as string,
              paddingHorizontal: BrandSpacing.controlX,
              paddingVertical: BrandSpacing.sm,
              gap: BrandSpacing.xs,
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
              {t("mapTab.web.limit")}
            </Text>
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: palette.text as string,
                fontVariant: ["tabular-nums"],
              }}
            >
              {t("mapTab.web.left", { count: 25 - selectedZones.length })}
            </Text>
          </View>
        </View>

        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
          }}
        >
          {focusedZoneLabel
            ? t("mapTab.web.focusPinned", {
                zone: focusedZoneLabel,
              })
            : t("mapTab.web.focusPrompt")}
        </Text>
      </View>

      <NativeSearchField
        value={zoneSearch}
        onChangeText={onSearchChange}
        placeholder={t("mapTab.searchPlaceholder")}
        clearAccessibilityLabel={t("common.clear")}
      />

      {saveError ? (
        <View
          style={{
            borderRadius: TERRITORY_RADIUS,
            borderCurve: "continuous",
            backgroundColor: palette.dangerSubtle as string,
            paddingHorizontal: BrandSpacing.controlX,
            paddingVertical: BrandSpacing.md,
          }}
        >
          <Text
            style={{
              ...BrandType.caption,
              color: palette.danger as string,
            }}
          >
            {saveError}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: BrandSpacing.md }}>
        <Text
          style={{
            ...BrandType.micro,
            color: palette.textMuted as string,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.liveTerritory")}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: BrandSpacing.sm, paddingBottom: BrandSpacing.xs }}
        >
          {selectedZones.length === 0 ? (
            <View
              style={{
                borderRadius: TERRITORY_RADIUS,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.lg,
                gap: BrandSpacing.xs,
              }}
            >
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: palette.text as string,
                }}
              >
                {t("mapTab.web.noTerritoryTitle")}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                {t("mapTab.web.noTerritoryBody")}
              </Text>
            </View>
          ) : (
            selectedZones.map((zone) => (
              <View
                key={zone.id}
                style={{
                  flexDirection: "row",
                  alignItems: "stretch",
                  gap: BrandSpacing.sm,
                  borderRadius: TERRITORY_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor:
                    focusZoneId === zone.id
                      ? (palette.primarySubtle as string)
                      : (palette.surface as string),
                  overflow: "hidden",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSetFocusZone(zone.id)}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: BrandSpacing.md,
                    paddingHorizontal: BrandSpacing.controlX,
                    paddingVertical: BrandSpacing.controlY,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color:
                          focusZoneId === zone.id
                            ? (palette.primary as string)
                            : (palette.text as string),
                      }}
                    >
                      {zone.label[zoneLanguage]}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color:
                          focusZoneId === zone.id
                            ? (palette.primary as string)
                            : (palette.textMuted as string),
                        opacity: focusZoneId === zone.id ? 0.78 : 1,
                      }}
                    >
                      {focusZoneId === zone.id
                        ? t("mapTab.web.focusedOnCanvas")
                        : t("mapTab.web.tapToFocus")}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("mapTab.mobile.removeZone", {
                    zone: zone.label[zoneLanguage],
                  })}
                  onPress={() => onToggleZone(zone.id)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: BrandSpacing.controlX,
                    paddingVertical: BrandSpacing.controlY,
                    backgroundColor:
                      focusZoneId === zone.id
                        ? (palette.primaryPressed as string)
                        : (palette.surfaceAlt as string),
                    opacity: pressed ? 0.88 : 1,
                  })}
                >
                  <IconSymbol
                    name="minus"
                    size={BrandSpacing.xs + BrandSpacing.sm}
                    color={
                      focusZoneId === zone.id
                        ? (palette.onPrimary as string)
                        : (palette.text as string)
                    }
                  />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={{ gap: BrandSpacing.md, flex: 1, minHeight: 0 }}>
        <Text
          style={{
            ...BrandType.micro,
            color: palette.textMuted as string,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {t("mapTab.web.atlasEyebrow")}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: BrandSpacing.sm, paddingBottom: BrandSpacing.sm }}
        >
          {filteredZones.map((zone) => {
            const selected = selectedZones.some((entry) => entry.id === zone.id);
            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                onPress={() => onToggleZone(zone.id)}
                style={({ pressed }) => ({
                  borderRadius: ZONE_SELECT_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor: selected
                    ? (palette.primary as string)
                    : (palette.surface as string),
                  paddingHorizontal: BrandSpacing.controlX,
                  paddingVertical: BrandSpacing.md,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: BrandSpacing.md,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.bodyStrong,
                      color: selected ? (palette.onPrimary as string) : (palette.text as string),
                    }}
                  >
                    {zone.label[zoneLanguage]}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: selected
                        ? (palette.onPrimary as string)
                        : (palette.textMuted as string),
                      opacity: selected ? 0.72 : 1,
                    }}
                  >
                    {selected ? t("mapTab.web.live") : t("mapTab.web.add")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
