import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { api } from "@/convex/_generated/api";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { ThemedText } from "@/components/themed-text";
import { KitFab } from "@/components/ui/kit";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones";
import { useBrand } from "@/hooks/use-brand";
import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { type RefObject, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

const MAX_ZONES = 25;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const zoneLanguage = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he")
    ? "he"
    : "en";
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

  const toggleZone = useCallback((zoneId: string) => {
    setSaveError(null);
    setSelectedZoneIds((current) => {
      if (current.includes(zoneId)) {
        return current.filter((id) => id !== zoneId);
      }
      if (current.length >= MAX_ZONES) {
        return current;
      }
      return [...current, zoneId];
    });
  }, []);

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

    const nextZoneIds = [...selectedZoneIds];
    const shouldSave = hasChanges;
    if (shouldSave && isSaving) return;
    setZoneModeActive(false);
    setSheetIndex(-1);
    setZoneSearch("");
    zoneSheetRef.current?.close();

    if (!shouldSave) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveZones({ zoneIds: nextZoneIds });
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : t("mapTab.errors.failedToSave"),
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
    return <Redirect href="/" />;
  }

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <QueueMap
        mode={zoneModeActive ? "zoneSelect" : "pinDrop"}
        pin={null}
        selectedZoneIds={selectedZoneIds}
        focusZoneId={null}
        {...(zoneModeActive ? { onPressZone: toggleZone } : {})}
        onPressMap={noopMapPress}
        onUseGps={noopUseGps}
        showGpsButton={false}
      />

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
            <ThemedText style={{ fontSize: 24, fontWeight: "600", color: palette.text, letterSpacing: -0.2 }}>
              {t("mapTab.title")}
            </ThemedText>
          </View>
          <BottomSheetTextInput
            value={zoneSearch}
            onChangeText={setZoneSearch}
            placeholder={t("mapTab.searchPlaceholder")}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.searchInput,
              {
                color: palette.text,
                borderBottomColor: palette.border,
              },
            ]}
          />
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
                <Pressable
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
                  {selected && <IconSymbol name="checkmark" size={16} color={palette.onPrimary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </BottomSheet>

      <TabOverlayAnchor side={zoneLanguage === "he" ? "left" : "right"} offset={BrandSpacing.lg}>
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
      </TabOverlayAnchor>
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
  searchInput: {
    fontSize: 16,
    fontWeight: "500",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
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
});
