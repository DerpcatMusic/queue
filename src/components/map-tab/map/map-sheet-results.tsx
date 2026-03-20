import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ZoneCityListItem } from "@/components/map-tab/zone-city-tree";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useIsRtl } from "@/hooks/use-is-rtl";

const MAP_RESULT_INDENT = BrandSpacing.xl + BrandSpacing.lg;
const MAP_RESULT_RADIUS = BrandRadius.card - BrandSpacing.md;

type MapSheetResultsProps = {
  isVisible: boolean;
  saveError: string | null;
  zoneCityItems: ZoneCityListItem[];
  zoneLanguage: "en" | "he";
  zoneModeActive: boolean;
  palette: BrandPalette;
  onPressZone: (zoneId: string) => void;
  onPressCity: (cityKey: string) => void;
  onToggleCityExpanded: (cityKey: string) => void;
};

export function MapSheetResults({
  isVisible,
  saveError,
  zoneCityItems,
  zoneLanguage,
  zoneModeActive,
  palette,
  onPressZone,
  onPressCity,
  onToggleCityExpanded,
}: MapSheetResultsProps) {
  const { t } = useTranslation();
  const isRtl = useIsRtl();

  if (!isVisible) {
    return null;
  }

  return (
    <View style={{ flex: 1, gap: BrandSpacing.sm }}>
      {saveError ? (
        <View
          style={{
            borderRadius: BrandRadius.card - BrandSpacing.sm,
            borderCurve: "continuous",
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
            backgroundColor: palette.dangerSubtle as string,
          }}
        >
          <ThemedText selectable style={{ color: palette.danger }}>
            {saveError}
          </ThemedText>
        </View>
      ) : null}

      <FlatList<ZoneCityListItem>
        data={zoneCityItems}
        keyExtractor={(item: ZoneCityListItem) => item.key}
        contentContainerStyle={{
          paddingTop: BrandSpacing.xs,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.xs,
        }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={28}
        windowSize={9}
        ItemSeparatorComponent={() => <View style={{ height: BrandSpacing.sm }} />}
        ListEmptyComponent={
          <View
            style={{
              borderRadius: 20,
              borderCurve: "continuous",
              paddingHorizontal: BrandSpacing.lg + BrandSpacing.xs / 2,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.xs,
              backgroundColor: palette.surfaceAlt as string,
            }}
          >
            <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
              {t("mapTab.mobile.noMatchingCities")}
            </Text>
            <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
              {t("mapTab.mobile.noMatchingCitiesHint")}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: ZoneCityListItem }) => {
          if (item.kind === "zone") {
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: BrandSpacing.md,
                  borderRadius: MAP_RESULT_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor: item.selected
                    ? (palette.primarySubtle as string)
                    : (palette.surfaceAlt as string),
                }}
              >
                <Pressable
                  onPress={() => onPressZone(item.zone.id)}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.md,
                    paddingLeft: MAP_RESULT_INDENT,
                    paddingRight: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.sm,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <View
                    style={{
                      width: BrandSpacing.sm - 2,
                      height: BrandSpacing.sm - 2,
                      borderRadius: (BrandSpacing.sm - 2) / 2,
                      backgroundColor: item.selected
                        ? (palette.primary as string)
                        : (palette.textMicro as string),
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...BrandType.caption, color: palette.text as string }}>
                      {item.zone.variantLabel[zoneLanguage]}
                    </Text>
                  </View>
                  {item.selected ? (
                    <IconSymbol
                      name="checkmark.circle.fill"
                      size={18}
                      color={palette.primary as string}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          }

          const zoneCount = item.group.zones.length;
          const isFullySelected = item.selectedCount === zoneCount;
          const isPartiallySelected = item.selectedCount > 0 && !isFullySelected;
          const summary = isFullySelected
            ? zoneCount > 1
              ? t("mapTab.mobile.summaryAllLive", { count: zoneCount })
              : null
            : isPartiallySelected
              ? t("mapTab.mobile.summarySomeLive", {
                  selected: item.selectedCount,
                  count: zoneCount,
                })
              : zoneCount > 1
                ? t("mapTab.mobile.summaryZones", { count: zoneCount })
                : null;

          return (
            <View
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                backgroundColor:
                  zoneModeActive && isFullySelected
                    ? (palette.primarySubtle as string)
                    : isPartiallySelected
                      ? (palette.primarySubtle as string)
                      : (palette.surfaceAlt as string),
                borderRadius: MAP_RESULT_RADIUS,
                borderCurve: "continuous",
              }}
            >
              <Pressable
                onPress={() => onPressCity(item.group.cityKey)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: isRtl ? "row-reverse" : "row",
                  alignItems: "center",
                  gap: BrandSpacing.md,
                  paddingHorizontal: BrandSpacing.lg,
                  paddingVertical: BrandSpacing.sm,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyMedium,
                      color:
                        zoneModeActive && isFullySelected
                          ? (palette.primary as string)
                          : (palette.text as string),
                    }}
                  >
                    {item.group.cityLabel[zoneLanguage]}
                  </Text>
                  {summary ? (
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: isPartiallySelected
                          ? (palette.primary as string)
                          : zoneModeActive && isFullySelected
                            ? (palette.primary as string)
                            : (palette.textMuted as string),
                        opacity: 0.92,
                      }}
                    >
                      {summary}
                    </Text>
                  ) : null}
                </View>
                {zoneModeActive && isFullySelected ? (
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={18}
                    color={palette.primary as string}
                  />
                ) : isPartiallySelected ? (
                  <IconSymbol
                    name="minus.circle.fill"
                    size={18}
                    color={palette.primary as string}
                  />
                ) : null}
              </Pressable>
              {item.showChevron ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => onToggleCityExpanded(item.group.cityKey)}
                  style={({ pressed }) => ({
                    paddingHorizontal: BrandSpacing.md,
                    paddingVertical: BrandSpacing.sm,
                    opacity: pressed ? 0.82 : 1,
                  })}
                >
                  <IconSymbol
                    name={item.expanded ? "chevron.down" : isRtl ? "chevron.left" : "chevron.right"}
                    size={15}
                    color={palette.textMuted as string}
                  />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
