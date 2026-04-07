import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";
import type { ZoneCityListItem } from "@/components/map-tab/zone-city-tree";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useIsRtl } from "@/hooks/use-is-rtl";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";

const MAP_RESULT_INDENT = BrandSpacing.xl + BrandSpacing.lg;
const MAP_RESULT_RADIUS = BrandRadius.card;
const MAP_RESULT_STATUS_DOT_SIZE = BrandSpacing.statusDot;
const MAP_RESULT_ERROR_RADIUS = BrandRadius.md;

type MapSheetResultsProps = {
  isVisible: boolean;
  saveError: string | null;
  zoneCityItems: ZoneCityListItem[];
  zoneLanguage: "en" | "he";
  zoneModeActive: boolean;
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
  onPressZone,
  onPressCity,
  onToggleCityExpanded,
}: MapSheetResultsProps) {
  const { t } = useTranslation();
  const isRtl = useIsRtl();
  const { color: palette } = useTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <View style={{ flex: 1, minHeight: 0, gap: BrandSpacing.sm, paddingTop: BrandSpacing.xs }}>
      {saveError ? (
        <View
          style={{
            borderRadius: MAP_RESULT_ERROR_RADIUS,
            borderCurve: "continuous",
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
            backgroundColor: palette.dangerSubtle,
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
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.xs,
          alignItems: "center",
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
              paddingHorizontal: BrandSpacing.insetSoft,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.xs,
              backgroundColor: palette.surfaceAlt,
            }}
          >
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: palette.text,
              }}
            >
              {t("mapTab.mobile.noMatchingCities")}
            </Text>
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted,
              }}
            >
              {t("mapTab.mobile.noMatchingCitiesHint")}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: ZoneCityListItem }) => {
          if (item.kind === "zone") {
            return (
              <View
                style={{
                  width: "95%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: BrandSpacing.md,
                  borderRadius: MAP_RESULT_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor: item.selected ? palette.primarySubtle : palette.surfaceElevated,
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
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: MAP_RESULT_STATUS_DOT_SIZE,
                      height: MAP_RESULT_STATUS_DOT_SIZE,
                      borderRadius: BrandRadius.statusDot,
                      backgroundColor: item.selected ? palette.primary : palette.textMicro,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.text,
                      }}
                    >
                      {item.zone.variantLabel[zoneLanguage]}
                    </Text>
                  </View>
                  {item.selected ? (
                    <IconSymbol
                      name="checkmark.circle.fill"
                      size={BrandSpacing.iconSm}
                      color={palette.primary}
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
                width: "95%",
                flexDirection: isRtl ? "row-reverse" : "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                backgroundColor:
                  zoneModeActive && isFullySelected
                    ? palette.primarySubtle
                    : isPartiallySelected
                      ? palette.primarySubtle
                      : palette.surfaceElevated,
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
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyMedium,
                      color: zoneModeActive && isFullySelected ? palette.primary : palette.text,
                    }}
                  >
                    {item.group.cityLabel[zoneLanguage]}
                  </Text>
                  {summary ? (
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: isPartiallySelected
                          ? palette.primary
                          : zoneModeActive && isFullySelected
                            ? palette.primary
                            : palette.textMuted,
                      }}
                    >
                      {summary}
                    </Text>
                  ) : null}
                </View>
                {zoneModeActive && isFullySelected ? (
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={BrandSpacing.iconSm}
                    color={palette.primary}
                  />
                ) : isPartiallySelected ? (
                  <IconSymbol
                    name="minus.circle.fill"
                    size={BrandSpacing.iconSm}
                    color={palette.primary}
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
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <IconSymbol
                    name={item.expanded ? "chevron.down" : isRtl ? "chevron.left" : "chevron.right"}
                    size={BrandSpacing.iconSm}
                    color={palette.textMuted}
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
