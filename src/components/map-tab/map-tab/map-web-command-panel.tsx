import type { TFunction } from "i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { NativeSearchField } from "@/components/ui/native-search-field";
import type { ZoneOption } from "@/constants/zones";
import { useTheme } from "@/hooks/use-theme";

type MapWebCommandPanelProps = {
  t: TFunction;
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
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        width: 360,
        borderRadius: 34,
        borderCurve: "continuous",
        backgroundColor: palette.surfaceAlt,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontFamily: "Lexend_500Medium",
            fontSize: 26,
            fontWeight: "500",
            letterSpacing: -0.24,
            lineHeight: 32,
            color: palette.text,
          }}
        >
          {t("mapTab.web.commandEyebrow")}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.textMuted,
          }}
        >
          {t("mapTab.web.commandBody")}
        </Text>
      </View>

      <View
        style={{
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: palette.surface,
          paddingHorizontal: 14,
          paddingVertical: 14,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceAlt,
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
              {t("mapTab.web.pending")}
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: 22,
                color: palette.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(pendingChangeCount)}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceAlt,
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
              {t("mapTab.web.limit")}
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: 22,
                color: palette.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {t("mapTab.web.left", { count: 25 - selectedZones.length })}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.textMuted,
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
            borderRadius: 20,
            borderCurve: "continuous",
            backgroundColor: palette.dangerSubtle,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope_400Regular",
              fontSize: 14,
              fontWeight: "400",
              lineHeight: 19,
              color: palette.danger,
            }}
          >
            {saveError}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
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
          {t("mapTab.web.liveTerritory")}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {selectedZones.length === 0 ? (
            <View
              style={{
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: palette.surface,
                paddingHorizontal: 14,
                paddingVertical: 16,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 16,
                  fontWeight: "600",
                  lineHeight: 22,
                  color: palette.text,
                }}
              >
                {t("mapTab.web.noTerritoryTitle")}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_400Regular",
                  fontSize: 14,
                  fontWeight: "400",
                  lineHeight: 19,
                  color: palette.textMuted,
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
                  gap: 10,
                  borderRadius: 22,
                  borderCurve: "continuous",
                  backgroundColor:
                    focusZoneId === zone.id ? palette.primarySubtle : palette.surface,
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
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 16,
                        fontWeight: "600",
                        lineHeight: 22,
                        color: focusZoneId === zone.id ? palette.onPrimary : palette.text,
                      }}
                    >
                      {zone.label[zoneLanguage]}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope_500Medium",
                        fontSize: 12,
                        fontWeight: "500",
                        letterSpacing: 0.2,
                        lineHeight: 16,
                        color: focusZoneId === zone.id ? palette.surfaceAlt : palette.textMuted,
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
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    backgroundColor:
                      focusZoneId === zone.id ? palette.primaryPressed : palette.surfaceAlt,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <IconSymbol
                    name="minus"
                    size={14}
                    color={focusZoneId === zone.id ? palette.onPrimary : palette.text}
                  />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={{ gap: 10, flex: 1, minHeight: 0 }}>
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
          {t("mapTab.web.atlasEyebrow")}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        >
          {filteredZones.map((zone) => {
            const selected = selectedZones.some((entry) => entry.id === zone.id);
            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                onPress={() => onToggleZone(zone.id)}
                style={({ pressed }) => ({
                  borderRadius: 20,
                  borderCurve: "continuous",
                  backgroundColor: selected ? palette.primaryPressed : palette.surface,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      fontSize: 16,
                      fontWeight: "600",
                      lineHeight: 22,
                      color: selected ? palette.onPrimary : palette.text,
                    }}
                  >
                    {zone.label[zoneLanguage]}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      fontSize: 12,
                      fontWeight: "500",
                      letterSpacing: 0.2,
                      lineHeight: 16,
                      color: selected ? palette.surfaceAlt : palette.textMuted,
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
