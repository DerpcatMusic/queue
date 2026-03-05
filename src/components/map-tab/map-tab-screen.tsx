import BottomSheet, {
  type BottomSheetBackgroundProps,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Redirect } from "expo-router";
import {
  type RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitFab, KitPressable } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";

const MAX_ZONES = 25;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const isFocused = useIsFocused();
  const zoneLanguage = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he") ? "he" : "en";
  const currentUser = useQuery(api.users.getCurrentUser);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [, setSheetIndex] = useState(-1);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const zoneSheetRef = useRef<BottomSheet>(null);
  const noopMapPress = useCallback(() => {}, []);
  const noopUseGps = useCallback(() => {}, []);

  useEffect(() => {
    if (!remoteZones) return;
    setSelectedZoneIds(remoteZones.zoneIds ?? []);
  }, [remoteZones]);

  const toggleZone = useCallback(
    (zoneId: string) => {
      if (Platform.OS === "ios") {
        void Haptics.selectionAsync();
      }
      setSaveError(null);
      setSelectedZoneIds((current) => {
        if (current.includes(zoneId)) {
          return current.filter((id) => id !== zoneId);
        }
        if (current.length >= MAX_ZONES) {
          setSaveError(
            t("mapTab.errors.maxZones", {
              max: MAX_ZONES,
              defaultValue: `You can select up to ${String(MAX_ZONES)} zones.`,
            }),
          );
          return current;
        }
        return [...current, zoneId];
      });
    },
    [t],
  );

  const persistedZoneIds = remoteZones?.zoneIds ?? [];

  const hasChanges = useMemo(() => {
    if (persistedZoneIds.length !== selectedZoneIds.length) return true;
    const currentSet = new Set(selectedZoneIds);
    return persistedZoneIds.some((id) => !currentSet.has(id));
  }, [persistedZoneIds, selectedZoneIds]);
  const deferredSelectedZoneIds = useDeferredValue(selectedZoneIds);
  const deferredSelectedZoneSet = useMemo(
    () => new Set(deferredSelectedZoneIds),
    [deferredSelectedZoneIds],
  );
  const deferredZoneSearch = useDeferredValue(zoneSearch);
  const filteredZones = useMemo(() => {
    const q = deferredZoneSearch.trim().toLowerCase();
    if (!q) return ZONE_OPTIONS;
    return ZONE_OPTIONS.filter((zone) => {
      const label = zone.label[zoneLanguage].toLowerCase();
      const fallback = zone.label.en.toLowerCase();
      const id = zone.id.toLowerCase();
      return label.includes(q) || fallback.includes(q) || id.includes(q);
    });
  }, [deferredZoneSearch, zoneLanguage]);
  const sheetSnapPoints = useMemo(() => ["18%", "78%"], []);

  const handlePrimaryAction = useCallback(async () => {
    if (!zoneModeActive) {
      setZoneModeActive(true);
      setSheetIndex(0);
      zoneSheetRef.current?.snapToIndex(0);
      return;
    }

    if (isSaving) return;
    if (!hasChanges) {
      setZoneModeActive(false);
      setSheetIndex(-1);
      setZoneSearch("");
      zoneSheetRef.current?.close();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveZones({ zoneIds: [...selectedZoneIds] });
      setZoneModeActive(false);
      setSheetIndex(-1);
      setZoneSearch("");
      zoneSheetRef.current?.close();
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message ? error.message : t("mapTab.errors.failedToSave"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, isSaving, saveZones, selectedZoneIds, t, zoneModeActive]);

  const backgroundComponent = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <Animated.View style={[style, { backgroundColor: "transparent" }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderCurve: "continuous",
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: palette.border,
            },
          ]}
        />
      </Animated.View>
    ),
    [palette],
  );

  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/studio" />;
  }

  if (remoteZones === undefined) {
    return <LoadingScreen label={t("mapTab.loading", { defaultValue: "Loading map..." })} />;
  }

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      {isFocused ? (
        <>
          <QueueMap
            mode={zoneModeActive ? "zoneSelect" : "pinDrop"}
            pin={null}
            selectedZoneIds={selectedZoneIds}
            focusZoneId={null}
            {...(zoneModeActive ? { onPressZone: toggleZone } : {})}
            onPressMap={noopMapPress}
            onUseGps={noopUseGps}
            showGpsButton
          />
          {saveError ? (
            <View style={styles.saveBannerWrap}>
              <NoticeBanner
                tone="error"
                message={saveError}
                onDismiss={() => setSaveError(null)}
                borderColor={palette.borderStrong}
                backgroundColor={palette.surface}
                textColor={palette.danger}
                iconColor={palette.danger}
              />
            </View>
          ) : null}

          <BottomSheet
            ref={zoneSheetRef as RefObject<BottomSheet>}
            index={zoneModeActive ? 0 : -1}
            snapPoints={sheetSnapPoints}
            enablePanDownToClose={false}
            enableContentPanningGesture
            keyboardBehavior="extend"
            android_keyboardInputMode="adjustResize"
            backgroundComponent={backgroundComponent}
            onChange={(index) => {
              if (index < 0) {
                setZoneModeActive(false);
                setSheetIndex(-1);
                setZoneSearch("");
                return;
              }
              setSheetIndex(index);
            }}
          >
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <ThemedText
                  style={{
                    fontSize: 24,
                    fontWeight: "600",
                    color: palette.text,
                    letterSpacing: -0.2,
                  }}
                >
                  {t("mapTab.title")}
                </ThemedText>
              </View>
              <View style={styles.searchWrap}>
                <View
                  style={[
                    styles.searchInputShell,
                    {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <IconSymbol name="magnifyingglass" size={16} color={palette.textMuted} />
                  <BottomSheetTextInput
                    value={zoneSearch}
                    onChangeText={setZoneSearch}
                    placeholder={t("mapTab.searchPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    clearButtonMode="while-editing"
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.searchInput, { color: palette.text }]}
                  />
                  {zoneSearch.length > 0 ? (
                    <KitPressable
                      accessibilityRole="button"
                      accessibilityLabel={t("common.clear", { defaultValue: "Clear" })}
                      hitSlop={8}
                      onPress={() => setZoneSearch("")}
                      rippleRadius={16}
                    >
                      <IconSymbol name="xmark.circle.fill" size={16} color={palette.textMuted} />
                    </KitPressable>
                  ) : null}
                </View>
              </View>
              {saveError ? (
                <ThemedText selectable style={{ color: palette.danger, paddingHorizontal: 24 }}>
                  {saveError}
                </ThemedText>
              ) : null}
              <BottomSheetFlatList<ZoneOption>
                data={filteredZones}
                keyExtractor={(item: ZoneOption) => item.id}
                contentContainerStyle={styles.zoneListContent}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                initialNumToRender={20}
                maxToRenderPerBatch={28}
                windowSize={9}
                updateCellsBatchingPeriod={16}
                renderItem={({ item }: { item: ZoneOption }) => {
                  const selected = deferredSelectedZoneSet.has(item.id);
                  return (
                    <KitPressable
                      onPress={() => toggleZone(item.id)}
                      style={[
                        styles.zoneRow,
                        {
                          borderBottomColor: palette.border,
                          backgroundColor: selected ? palette.primary : "transparent",
                        },
                      ]}
                    >
                      <ThemedText
                        numberOfLines={1}
                        style={{
                          color: selected ? palette.onPrimary : palette.text,
                          fontSize: 15,
                          fontWeight: "500",
                          letterSpacing: -0.1,
                        }}
                      >
                        {item.label[zoneLanguage]}
                      </ThemedText>
                      {selected && (
                        <IconSymbol name="checkmark" size={16} color={palette.onPrimary} />
                      )}
                    </KitPressable>
                  );
                }}
              />
            </View>
          </BottomSheet>

          <TabOverlayAnchor
            side={zoneLanguage === "he" ? "left" : "right"}
            offset={BrandSpacing.lg}
          >
            <KitFab
              selected={zoneModeActive}
              disabled={isSaving}
              icon={
                <IconSymbol
                  name={zoneModeActive ? "checkmark.circle.fill" : "slider.horizontal.3"}
                  size={20}
                  color={zoneModeActive ? palette.onPrimary : palette.text}
                />
              }
              style={{
                backgroundColor: zoneModeActive ? palette.primary : palette.surface,
                borderColor: zoneModeActive ? palette.primaryPressed : palette.borderStrong,
                borderWidth: 1.4,
                opacity: 1,
              }}
              onPress={() => {
                void handlePrimaryAction();
              }}
            />
            <View
              style={[
                styles.modeHint,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <ThemedText style={{ color: palette.textMuted }}>
                {zoneModeActive
                  ? t("mapTab.actions.saveChanges", { defaultValue: "Save zones" })
                  : t("mapTab.actions.editZones", { defaultValue: "Edit zones" })}
              </ThemedText>
            </View>
          </TabOverlayAnchor>
        </>
      ) : null}
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingTop: 16,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  searchInputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 16,
  },
  zoneListContent: {
    paddingBottom: 48,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  saveBannerWrap: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  modeHint: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-end",
  },
});
