import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import type { ZoneListRow } from "@/components/map-tab/zone-selection-model";
import BottomSheet, {
  BottomSheetBackgroundProps,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { TFunction } from "i18next";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

const MAX_ZONES = 25;
const SEARCH_INPUT_DEBOUNCE_MS = 120;
const CITY_ROW_HEIGHT = 76;
const ZONE_ROW_HEIGHT = 72;

function formatZoneCountLabel(count: number, label: "zones" | "matching zones") {
  if (count === 1) {
    return label === "zones" ? "1 zone" : "1 matching zone";
  }
  return `${count} ${label}`;
}

type MapZoneModeSheetProps = {
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  errorMessage: string | null;
  insets: EdgeInsets;
  isDirty: boolean;
  isRtl: boolean;
  isSaving: boolean;
  language: "en" | "he";
  mapSelectionLevel: "city" | "zone";
  onDiscard: () => void;
  onSaveAndClose: () => void;
  onToggleCityExpanded: (cityKey: string) => void;
  onToggleZone: (zoneId: string) => void;
  onToggleZoneIds: (zoneIds: string[]) => void;
  palette: BrandPalette;
  selectedZoneCount: number;
  t: TFunction;
  zoneListRows: ZoneListRow[];
  zoneSearch: string;
  onZoneSearchChange: (text: string) => void;
};

function MapZoneModeSheetInner({
  bottomSheetRef,
  errorMessage,
  insets,
  isDirty,
  isRtl,
  isSaving,
  language,
  mapSelectionLevel,
  onDiscard,
  onSaveAndClose,
  onToggleCityExpanded,
  onToggleZone,
  onToggleZoneIds,
  palette,
  selectedZoneCount,
  t,
  zoneListRows,
  zoneSearch,
  onZoneSearchChange,
}: MapZoneModeSheetProps) {
  const snapPoints = useMemo(() => ["35%", "65%", "92%"], []);
  const [searchInput, setSearchInput] = useState(zoneSearch);
  const trimmedZoneSearch = zoneSearch.trim();

  useEffect(() => {
    setSearchInput(zoneSearch);
  }, [zoneSearch]);

  useEffect(() => {
    if (searchInput === zoneSearch) return;
    const timer = setTimeout(() => {
      onZoneSearchChange(searchInput);
    }, SEARCH_INPUT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [onZoneSearchChange, searchInput, zoneSearch]);

  const rowOffsets = useMemo(() => {
    const offsets = new Array<number>(zoneListRows.length);
    let offset = 0;
    for (let index = 0; index < zoneListRows.length; index += 1) {
      offsets[index] = offset;
      offset += zoneListRows[index]?.kind === "city" ? CITY_ROW_HEIGHT : ZONE_ROW_HEIGHT;
    }
    return offsets;
  }, [zoneListRows]);

  const CustomBackground = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <Animated.View style={[style, { backgroundColor: "transparent" }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            },
          ]}
        />
      </Animated.View>
    ),
    [palette.surface],
  );

  const CustomHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View
          style={[
            styles.handleIndicator,
            { backgroundColor: palette.borderStrong },
          ]}
        />
      </View>
    ),
    [palette.borderStrong],
  );

  const renderZoneRow = useCallback(
    ({ item }: { item: ZoneListRow }) => {
      if (item.kind === "zone") {
        return (
          <Pressable
            style={[
              styles.childZoneItem,
              {
                borderColor: palette.border,
                marginLeft: 12,
                marginRight: 12,
                marginBottom: 8,
              },
              item.selected && {
                backgroundColor: palette.primarySubtle,
                borderColor: palette.primary,
              },
            ]}
            onPress={() => onToggleZone(item.zone.id)}
          >
            <View style={styles.dropdownItemContent}>
              <ThemedText numberOfLines={1}>{item.zone.label[language]}</ThemedText>
              <View style={styles.zoneMetaRow}>
                <View
                  style={[
                    styles.zoneMetaPill,
                    {
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                    },
                  ]}
                >
                  <ThemedText
                    style={{ color: palette.textMuted, fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {item.zone.id}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: palette.textMuted, fontSize: 12 }} numberOfLines={1}>
                  {`${item.zone.seconds}s`}
                </ThemedText>
              </View>
            </View>
            {item.selected ? (
              <IconSymbol name="checkmark.circle.fill" size={20} color={palette.primary} />
            ) : null}
          </Pressable>
        );
      }

      const { group, isExpanded } = item;
      const isPartialSelection = group.selectedCount > 0 && !group.isFullySelected;
      return (
        <Pressable
          style={[
            styles.dropdownItem,
            {
              borderBottomColor: palette.border,
              borderColor: group.selectedCount > 0 ? palette.primary : palette.border,
              backgroundColor:
                group.selectedCount > 0 ? palette.primarySubtle : palette.surface,
            },
          ]}
          onPress={() => onToggleZoneIds(group.zoneIds)}
        >
          <View style={styles.dropdownItemContent}>
            <ThemedText type="defaultSemiBold" numberOfLines={1}>
              {group.cityLabel}
            </ThemedText>
            <ThemedText style={{ color: palette.textMuted, fontSize: 13 }} numberOfLines={1}>
              {group.hasSplits
                ? trimmedZoneSearch.length > 0 && !isExpanded
                  ? formatZoneCountLabel(group.matchingZoneCount, "matching zones")
                  : formatZoneCountLabel(group.zones.length, "zones")
                : `${group.zones[0]?.id ?? ""} - ${group.zones[0]?.seconds ?? 0}s`}
            </ThemedText>
          </View>

          <View style={styles.dropdownItemActions}>
            <View
              style={[
                styles.cityCountPill,
                {
                  borderColor:
                    group.selectedCount > 0 ? palette.primary : palette.borderStrong,
                  backgroundColor: palette.surface,
                },
              ]}
            >
              <ThemedText
                type="micro"
                style={{
                  color:
                    group.selectedCount > 0 ? palette.primary : palette.textMuted,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`${group.selectedCount}/${group.zones.length}`}
              </ThemedText>
            </View>

            {group.hasSplits ? (
              <Pressable
                hitSlop={8}
                onPress={() => onToggleCityExpanded(group.cityKey)}
                onPressIn={(event) => {
                  event.stopPropagation();
                }}
                style={styles.expandAction}
              >
                <IconSymbol
                  name={
                    isExpanded
                      ? "chevron.down"
                      : isRtl
                        ? "chevron.left"
                        : "chevron.right"
                  }
                  size={18}
                  color={palette.textMuted}
                />
              </Pressable>
            ) : null}

            {group.isFullySelected ? (
              <IconSymbol name="checkmark.circle.fill" size={24} color={palette.primary} />
            ) : isPartialSelection ? (
              <IconSymbol name="minus.circle.fill" size={24} color={palette.textMuted} />
            ) : null}
          </View>
        </Pressable>
      );
    },
    [
      isRtl,
      language,
      onToggleCityExpanded,
      onToggleZone,
      onToggleZoneIds,
      palette,
      trimmedZoneSearch.length,
    ],
  );

  const getItemLayout = useCallback(
    (_data: ZoneListRow[] | null | undefined, index: number) => ({
      length: zoneListRows[index]?.kind === "city" ? CITY_ROW_HEIGHT : ZONE_ROW_HEIGHT,
      offset: rowOffsets[index] ?? 0,
      index,
    }),
    [rowOffsets, zoneListRows],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backgroundComponent={CustomBackground}
      handleComponent={CustomHandle}
      topInset={insets.top + 8}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={false}
    >
      <View
        style={[
          styles.searchStickyBlock,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.panelHeader}>
          <ThemedText type="title" numberOfLines={1}>
            {t("mapTab.zoneModeOn")}
          </ThemedText>
          <ThemedText style={{ color: palette.textMuted, fontSize: 13, fontWeight: "600" }}>
            {selectedZoneCount} / {MAX_ZONES}
          </ThemedText>
        </View>
        <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
          {mapSelectionLevel === "city"
            ? "Zoom in to select split zones"
            : "Zoom out to select full city coverage"}
        </ThemedText>
        <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
          {t("mapTab.zoneModeHint")}
        </ThemedText>

        <View style={styles.searchRow}>
          <BottomSheetTextInput
            value={searchInput}
            onChangeText={setSearchInput}
            onFocus={() => {
              bottomSheetRef.current?.snapToIndex(2);
            }}
            placeholder={t("mapTab.searchPlaceholder")}
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[
              styles.searchInput,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.appBg,
              },
            ]}
          />
        </View>
      </View>

      <BottomSheetFlatList
        data={zoneListRows}
        keyExtractor={(item: ZoneListRow) => item.key}
        renderItem={renderZoneRow}
        contentContainerStyle={[
          styles.dropdownContent,
          { paddingBottom: Math.max(insets.bottom + 144, 160), paddingTop: 8 },
        ]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={18}
        maxToRenderPerBatch={20}
        windowSize={8}
        updateCellsBatchingPeriod={24}
        removeClippedSubviews
        getItemLayout={getItemLayout}
        ListEmptyComponent={
          <ThemedText style={{ color: palette.textMuted, textAlign: "center", marginTop: 24 }}>
            {t("mapTab.noMatchingZones")}
          </ThemedText>
        }
        ListFooterComponent={
          errorMessage ? (
            <ThemedText style={{ color: palette.danger, marginTop: 16 }} numberOfLines={2}>
              {errorMessage}
            </ThemedText>
          ) : null
        }
      />

      <View
        style={[
          styles.zoneModeFooter,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Pressable
          style={[
            styles.zoneModeAction,
            {
              borderColor: palette.borderStrong,
              backgroundColor: palette.surfaceAlt,
            },
          ]}
          disabled={isSaving}
          onPress={onDiscard}
        >
          <ThemedText type="defaultSemiBold" style={{ color: palette.text }}>
            {t("onboarding.back")}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.zoneModeAction,
            {
              borderColor: palette.primary,
              backgroundColor: isDirty ? palette.primarySubtle : palette.surface,
              opacity: isSaving ? 0.72 : 1,
            },
          ]}
          disabled={isSaving}
          onPress={onSaveAndClose}
        >
          <ThemedText type="defaultSemiBold" style={{ color: palette.primary }}>
            {isSaving
              ? t("mapTab.saving")
              : isDirty
                ? t("mapTab.save")
                : t("jobsTab.actions.done")}
          </ThemedText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export const MapZoneModeSheet = memo(MapZoneModeSheetInner);

const styles = StyleSheet.create({
  searchStickyBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 3,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  dropdownContent: {
    paddingHorizontal: 12,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    marginBottom: 8,
  },
  dropdownItemContent: {
    flex: 1,
    gap: 4,
  },
  zoneMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zoneMetaPill: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dropdownItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  expandAction: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  cityCountPill: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: "center",
  },
  childZoneItem: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoneModeFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  zoneModeAction: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  handleContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
  },
  handleIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});
