import BottomSheet, {
  type BottomSheetBackgroundProps,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
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
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import {
  buildZoneCityGroups,
  buildZoneCityListItems,
  type ZoneCityListItem,
} from "@/components/map-tab/zone-city-tree";
import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { resolveCurrentLocationToZone } from "@/lib/location-zone";

const MAX_ZONES = 25;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { overlayBottom, safeTop } = useAppInsets();
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
  const [expandedCityKeys, setExpandedCityKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [mapPin, setMapPin] = useState<QueueMapPin | null>(null);
  const zoneSheetRef = useRef<BottomSheet>(null);
  const noopMapPress = useCallback(() => {}, []);
  const handleFocusSelection = useCallback(() => {
    const nextFocusZoneId = focusZoneId ?? selectedZoneIds[0] ?? remoteZones?.zoneIds?.[0] ?? null;
    if (!nextFocusZoneId) return;
    setFocusZoneId(nextFocusZoneId);
  }, [focusZoneId, remoteZones?.zoneIds, selectedZoneIds]);

  const handleUseGps = useCallback(async () => {
    setSaveError(null);
    try {
      if (Platform.OS === "ios") {
        void Haptics.selectionAsync();
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error(t("mapTab.errors.locationPermission", {}));
      }
      const location = await Location.getCurrentPositionAsync({});
      setMapPin({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      const resolved = await resolveCurrentLocationToZone();
      setFocusZoneId(resolved.zoneId);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : t("mapTab.errors.failedToLoadLocation"),
      );
    }
  }, [t]);

  useEffect(() => {
    if (!remoteZones) return;
    setSelectedZoneIds(remoteZones.zoneIds ?? []);
  }, [remoteZones]);

  const applySelectedZoneIds = useCallback(
    (nextZoneIds: string[], preferredFocusZoneId?: string | null) => {
      const dedupedZoneIds = [...new Set(nextZoneIds)];
      if (dedupedZoneIds.length > MAX_ZONES) {
        setSaveError(t("mapTab.errors.maxZones", { max: MAX_ZONES }));
        return false;
      }

      setSaveError(null);
      setSelectedZoneIds(dedupedZoneIds);
      setFocusZoneId((currentFocusZoneId) => {
        if (preferredFocusZoneId && dedupedZoneIds.includes(preferredFocusZoneId)) {
          return preferredFocusZoneId;
        }
        if (currentFocusZoneId && dedupedZoneIds.includes(currentFocusZoneId)) {
          return currentFocusZoneId;
        }
        return dedupedZoneIds[0] ?? null;
      });
      return true;
    },
    [t],
  );

  const toggleZone = useCallback(
    (zoneId: string) => {
      if (Platform.OS === "ios") {
        void Haptics.selectionAsync();
      }
      const isSelected = selectedZoneIds.includes(zoneId);
      const nextZoneIds = isSelected
        ? selectedZoneIds.filter((id) => id !== zoneId)
        : [...selectedZoneIds, zoneId];
      const preferredFocusZoneId = isSelected && focusZoneId === zoneId ? null : zoneId;
      applySelectedZoneIds(nextZoneIds, preferredFocusZoneId);
    },
    [applySelectedZoneIds, focusZoneId, selectedZoneIds],
  );

  const persistedZoneIds = (remoteZones?.zoneIds ?? []) as string[];

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
  const expandedCityKeySet = useMemo(() => new Set(expandedCityKeys), [expandedCityKeys]);
  const deferredZoneSearch = useDeferredValue(zoneSearch);
  const zoneCityGroups = useMemo(() => buildZoneCityGroups(ZONE_OPTIONS), []);
  const zoneCityByZoneId = useMemo(() => {
    const entries = new Map<string, string>();
    for (const group of zoneCityGroups) {
      for (const zone of group.zones) {
        entries.set(zone.id, group.cityKey);
      }
    }
    return entries;
  }, [zoneCityGroups]);
  const zoneCityGroupByKey = useMemo(
    () => new Map(zoneCityGroups.map((group) => [group.cityKey, group])),
    [zoneCityGroups],
  );
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
  const zoneCityItems = useMemo(
    () =>
      buildZoneCityListItems({
        groups: zoneCityGroups,
        language: zoneLanguage,
        query: deferredZoneSearch,
        expandedCityKeys: expandedCityKeySet,
        selectedZoneIds: deferredSelectedZoneSet,
      }),
    [deferredSelectedZoneSet, deferredZoneSearch, expandedCityKeySet, zoneCityGroups, zoneLanguage],
  );
  const selectedZones = useMemo(
    () => ZONE_OPTIONS.filter((zone) => deferredSelectedZoneSet.has(zone.id)),
    [deferredSelectedZoneSet],
  );
  const focusedZone = useMemo(
    () => ZONE_OPTIONS.find((zone) => zone.id === focusZoneId) ?? null,
    [focusZoneId],
  );
  const pendingChangeCount = useMemo(() => {
    const persistedSet = new Set(persistedZoneIds);
    const selectedSet = new Set(selectedZoneIds);
    let delta = 0;

    for (const zoneId of selectedSet) {
      if (!persistedSet.has(zoneId)) delta += 1;
    }
    for (const zoneId of persistedSet) {
      if (!selectedSet.has(zoneId)) delta += 1;
    }

    return delta;
  }, [persistedZoneIds, selectedZoneIds]);
  const sheetSnapPoints = useMemo(() => ["24%", "82%"], []);

  useEffect(() => {
    if (!zoneModeActive) {
      return;
    }
    setExpandedCityKeys((current) => {
      const next = new Set(current);
      for (const zoneId of selectedZoneIds) {
        const cityKey = zoneCityByZoneId.get(zoneId);
        if (cityKey) {
          next.add(cityKey);
        }
      }
      if (focusZoneId) {
        const cityKey = zoneCityByZoneId.get(focusZoneId);
        if (cityKey) {
          next.add(cityKey);
        }
      }
      return next.size === current.length ? current : [...next];
    });
  }, [focusZoneId, selectedZoneIds, zoneCityByZoneId, zoneModeActive]);

  const toggleCityExpanded = useCallback((cityKey: string) => {
    setExpandedCityKeys((current) =>
      current.includes(cityKey)
        ? current.filter((entry) => entry !== cityKey)
        : [...current, cityKey],
    );
  }, []);

  const toggleCity = useCallback(
    (cityKey: string) => {
      const group = zoneCityGroupByKey.get(cityKey);
      if (!group) return;
      if (Platform.OS === "ios") {
        void Haptics.selectionAsync();
      }

      const cityZoneIds = group.zones.map((zone) => zone.id);
      const isFullySelected = cityZoneIds.every((zoneId) => selectedZoneIds.includes(zoneId));
      const nextZoneIds = isFullySelected
        ? selectedZoneIds.filter((zoneId) => !cityZoneIds.includes(zoneId))
        : [...selectedZoneIds, ...cityZoneIds];
      const preferredFocusZoneId = isFullySelected ? null : (cityZoneIds[0] ?? null);

      if (applySelectedZoneIds(nextZoneIds, preferredFocusZoneId) && !isFullySelected) {
        setExpandedCityKeys((current) =>
          current.includes(cityKey) ? current : [...current, cityKey],
        );
      }
    },
    [applySelectedZoneIds, selectedZoneIds, zoneCityGroupByKey],
  );

  const openZoneEditor = useCallback(() => {
    setSaveError(null);
    setZoneModeActive(true);
    setSheetIndex(1);
    zoneSheetRef.current?.snapToIndex(1);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setSelectedZoneIds(persistedZoneIds);
    setFocusZoneId(persistedZoneIds[0] ?? null);
    setSaveError(null);
    setZoneModeActive(false);
    setSheetIndex(-1);
    setZoneSearch("");
    zoneSheetRef.current?.close();
  }, [persistedZoneIds]);

  const handleSaveZones = useCallback(async () => {
    const nextZoneIds = [...selectedZoneIds];
    const shouldSave = hasChanges;
    if (shouldSave && isSaving) return;

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
      await saveZones({ zoneIds: nextZoneIds });
      setFocusZoneId(nextZoneIds[0] ?? null);
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
  }, [hasChanges, isSaving, saveZones, selectedZoneIds, t]);

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
    return <LoadingScreen label={t("mapTab.loading")} />;
  }

  if (Platform.OS === "web") {
    return (
      <TabScreenRoot
        mode="static"
        style={{ backgroundColor: palette.surface as string }}
        topInsetTone="card"
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 22,
            paddingTop: 22,
            paddingBottom: 22,
            gap: 18,
          }}
        >
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
              <Text style={{ ...BrandType.body, color: palette.textMuted as string }}>
                {t("mapTab.web.workspaceBody")}
              </Text>
            </View>

            <View
              style={{
                width: 320,
                borderRadius: 30,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 18,
                paddingVertical: 18,
                gap: 8,
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
                  opacity: 0.86,
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
                    backgroundColor: "rgba(255,255,255,0.14)",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
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
                    {String(persistedZoneIds.length)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1.25,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.14)",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
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
                    {focusedZone ? focusedZone.label[zoneLanguage] : t("mapTab.web.auto")}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: "auto" }}>
                <KitButton
                  label={
                    isSaving ? t("mapTab.mobile.saveCoverageSaving") : t("mapTab.web.saveCoverage")
                  }
                  onPress={() => {
                    void handleSaveZones();
                  }}
                  disabled={!hasChanges || isSaving}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  style={{ backgroundColor: palette.onPrimary as string }}
                />
                <KitButton
                  label={t("mapTab.web.resetToLive")}
                  onPress={handleDiscardChanges}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  disabled={!hasChanges || isSaving}
                  style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                />
              </View>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: 18 }}>
            <View
              style={{
                flex: 1.45,
                minWidth: 0,
                borderRadius: 34,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: palette.surfaceAlt as string,
              }}
            >
              <QueueMap
                mode="zoneSelect"
                pin={mapPin}
                selectedZoneIds={selectedZoneIds}
                focusZoneId={focusZoneId}
                onPressZone={toggleZone}
                onPressMap={noopMapPress}
                onUseGps={handleFocusSelection}
                showGpsButton={false}
              />
            </View>

            <View
              style={{
                width: 360,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                paddingHorizontal: 16,
                paddingVertical: 16,
                gap: 14,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: 26,
                    color: palette.text as string,
                  }}
                >
                  {t("mapTab.web.commandEyebrow")}
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  {t("mapTab.web.commandBody")}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
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
                      backgroundColor: palette.surfaceAlt as string,
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
                      borderRadius: 18,
                      borderCurve: "continuous",
                      backgroundColor: palette.surfaceAlt as string,
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
                      {t("mapTab.web.limit")}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {t("mapTab.web.left", { count: MAX_ZONES - selectedZoneIds.length })}
                    </Text>
                  </View>
                </View>

                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  {focusedZone
                    ? t("mapTab.web.focusPinned", { zone: focusedZone.label[zoneLanguage] })
                    : t("mapTab.web.focusPrompt")}
                </Text>
              </View>

              <NativeSearchField
                value={zoneSearch}
                onChangeText={setZoneSearch}
                placeholder={t("mapTab.searchPlaceholder")}
                clearAccessibilityLabel={t("common.clear")}
              />

              {saveError ? (
                <View
                  style={{
                    borderRadius: 20,
                    borderCurve: "continuous",
                    backgroundColor: palette.dangerSubtle as string,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ ...BrandType.caption, color: palette.danger as string }}>
                    {saveError}
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
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
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {selectedZones.length === 0 ? (
                    <View
                      style={{
                        borderRadius: 22,
                        borderCurve: "continuous",
                        backgroundColor: palette.surface as string,
                        paddingHorizontal: 14,
                        paddingVertical: 16,
                        gap: 4,
                      }}
                    >
                      <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
                        {t("mapTab.web.noTerritoryTitle")}
                      </Text>
                      <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                        {t("mapTab.web.noTerritoryBody")}
                      </Text>
                    </View>
                  ) : (
                    selectedZones.map((zone) => (
                      <KitPressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setFocusZoneId(zone.id);
                        }}
                        style={{
                          borderRadius: 22,
                          borderCurve: "continuous",
                          backgroundColor:
                            focusZoneId === zone.id
                              ? (palette.primary as string)
                              : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 14,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{
                                ...BrandType.bodyStrong,
                                color:
                                  focusZoneId === zone.id
                                    ? (palette.onPrimary as string)
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
                                    ? "rgba(255,255,255,0.72)"
                                    : (palette.textMuted as string),
                              }}
                            >
                              {focusZoneId === zone.id
                                ? t("mapTab.web.focusedOnCanvas")
                                : t("mapTab.web.tapToFocus")}
                            </Text>
                          </View>
                          <KitPressable
                            accessibilityRole="button"
                            accessibilityLabel={t("mapTab.mobile.removeZone", {
                              zone: zone.label[zoneLanguage],
                            })}
                            onPress={() => toggleZone(zone.id)}
                            style={{
                              borderRadius: 999,
                              backgroundColor:
                                focusZoneId === zone.id
                                  ? "rgba(255,255,255,0.14)"
                                  : (palette.surfaceAlt as string),
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                            }}
                          >
                            <IconSymbol
                              name="minus"
                              size={14}
                              color={
                                focusZoneId === zone.id
                                  ? (palette.onPrimary as string)
                                  : (palette.text as string)
                              }
                            />
                          </KitPressable>
                        </View>
                      </KitPressable>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={{ gap: 10, flex: 1, minHeight: 0 }}>
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
                  contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                >
                  {filteredZones.map((zone) => {
                    const selected = deferredSelectedZoneSet.has(zone.id);
                    return (
                      <KitPressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => toggleZone(zone.id)}
                        style={{
                          borderRadius: 20,
                          borderCurve: "continuous",
                          backgroundColor: selected
                            ? (palette.primary as string)
                            : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
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
                              ...BrandType.bodyStrong,
                              color: selected
                                ? (palette.onPrimary as string)
                                : (palette.text as string),
                            }}
                          >
                            {zone.label[zoneLanguage]}
                          </Text>
                          <Text
                            style={{
                              ...BrandType.micro,
                              color: selected
                                ? "rgba(255,255,255,0.72)"
                                : (palette.textMuted as string),
                            }}
                          >
                            {selected ? t("mapTab.web.live") : t("mapTab.web.add")}
                          </Text>
                        </View>
                      </KitPressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </TabScreenRoot>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg as string }}>
      {isFocused ? (
        <>
          <QueueMap
            mode="zoneSelect"
            pin={mapPin}
            selectedZoneIds={selectedZoneIds}
            focusZoneId={focusZoneId}
            {...(zoneModeActive ? { onPressZone: toggleZone } : {})}
            onPressMap={noopMapPress}
            onUseGps={handleUseGps}
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

          {zoneModeActive ? (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: safeTop + BrandSpacing.lg,
                left: BrandSpacing.lg,
                right: BrandSpacing.lg,
                zIndex: 30,
              }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: 260,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: palette.primary as string,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.onPrimary as string,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    opacity: 0.78,
                  }}
                >
                  {t("mapTab.mobile.editingEyebrow")}
                </Text>
                <Text
                  style={{
                    fontFamily: "BarlowCondensed_800ExtraBold",
                    fontSize: 28,
                    lineHeight: 26,
                    letterSpacing: -0.6,
                    color: palette.onPrimary as string,
                  }}
                >
                  {t("mapTab.mobile.activeZones", { count: selectedZoneIds.length })}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: "rgba(255,255,255,0.78)",
                  }}
                >
                  {hasChanges
                    ? t("mapTab.mobile.stagedReady", { count: pendingChangeCount })
                    : t("mapTab.mobile.editingHint")}
                </Text>
              </View>
            </View>
          ) : null}

          {saveError ? (
            <TabOverlayAnchor side="left" offset={BrandSpacing.lg}>
              <View
                style={{
                  maxWidth: 280,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: palette.dangerSubtle,
                }}
              >
                <ThemedText selectable style={{ color: palette.danger }}>
                  {saveError}
                </ThemedText>
              </View>
            </TabOverlayAnchor>
          ) : null}

          <BottomSheet
            ref={zoneSheetRef as RefObject<BottomSheet>}
            index={zoneModeActive ? 1 : -1}
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
                setSaveError(null);
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
                  {t("mapTab.mobile.sheetTitle")}
                </ThemedText>
                <ThemedText
                  style={{
                    marginTop: 4,
                    color: palette.textMuted,
                    fontSize: 13,
                  }}
                >
                  {hasChanges
                    ? t("mapTab.mobile.sheetPending", { count: pendingChangeCount })
                    : t("mapTab.mobile.sheetHint")}
                </ThemedText>
              </View>
              <View style={styles.searchWrap}>
                <View
                  style={[
                    styles.searchInputShell,
                    {
                      backgroundColor: palette.surfaceAlt,
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
                      accessibilityLabel={t("common.clear")}
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
              <BottomSheetFlatList<ZoneCityListItem>
                data={zoneCityItems}
                keyExtractor={(item: ZoneCityListItem) => item.key}
                contentContainerStyle={styles.zoneListContent}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                initialNumToRender={20}
                maxToRenderPerBatch={28}
                windowSize={9}
                updateCellsBatchingPeriod={16}
                ListEmptyComponent={
                  <View
                    style={[
                      styles.emptyZoneSearchState,
                      { backgroundColor: palette.surfaceAlt as string },
                    ]}
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
                      <KitPressable
                        onPress={() => toggleZone(item.zone.id)}
                        style={[
                          styles.zoneChildRow,
                          {
                            backgroundColor: item.selected
                              ? (palette.primarySubtle as string)
                              : (palette.surface as string),
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.zoneChildBullet,
                            {
                              backgroundColor: item.selected
                                ? (palette.primary as string)
                                : (palette.borderStrong as string),
                            },
                          ]}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={{
                              ...BrandType.bodyStrong,
                              color: palette.text as string,
                            }}
                          >
                            {item.zone.variantLabel[zoneLanguage]}
                          </Text>
                          <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
                            {item.zone.id}
                          </Text>
                        </View>
                        {item.selected ? (
                          <IconSymbol
                            name="checkmark.circle.fill"
                            size={18}
                            color={palette.primary as string}
                          />
                        ) : null}
                      </KitPressable>
                    );
                  }

                  const zoneCount = item.group.zones.length;
                  const isFullySelected = item.selectedCount === zoneCount;
                  const isPartiallySelected = item.selectedCount > 0 && !isFullySelected;
                  const summary =
                    zoneCount === 1
                      ? (item.group.zones[0]?.id ?? item.group.cityKey)
                      : isFullySelected
                        ? t("mapTab.mobile.summaryAllLive", { count: zoneCount })
                        : isPartiallySelected
                          ? t("mapTab.mobile.summarySomeLive", {
                              selected: item.selectedCount,
                              count: zoneCount,
                            })
                          : t("mapTab.mobile.summaryZones", { count: zoneCount });

                  return (
                    <KitPressable
                      onPress={() => toggleCity(item.group.cityKey)}
                      style={[
                        styles.zoneCityRow,
                        {
                          backgroundColor: isFullySelected
                            ? (palette.primary as string)
                            : isPartiallySelected
                              ? (palette.primarySubtle as string)
                              : (palette.surfaceAlt as string),
                        },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            ...BrandType.heading,
                            fontSize: 21,
                            lineHeight: 24,
                            color: isFullySelected
                              ? (palette.onPrimary as string)
                              : (palette.text as string),
                          }}
                        >
                          {item.group.cityLabel[zoneLanguage]}
                        </Text>
                        <Text
                          style={{
                            ...BrandType.micro,
                            color: isFullySelected
                              ? "rgba(255,255,255,0.78)"
                              : isPartiallySelected
                                ? (palette.primary as string)
                                : (palette.textMuted as string),
                            letterSpacing: 0.2,
                          }}
                        >
                          {summary}
                        </Text>
                      </View>
                      <View style={styles.zoneCityActions}>
                        {isFullySelected ? (
                          <IconSymbol
                            name="checkmark.circle.fill"
                            size={20}
                            color={palette.onPrimary as string}
                          />
                        ) : isPartiallySelected ? (
                          <IconSymbol
                            name="minus.circle.fill"
                            size={20}
                            color={palette.primary as string}
                          />
                        ) : null}
                        {item.showChevron ? (
                          <KitPressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              item.expanded
                                ? t("mapTab.mobile.collapseCity", {
                                    city: item.group.cityLabel[zoneLanguage],
                                  })
                                : t("mapTab.mobile.expandCity", {
                                    city: item.group.cityLabel[zoneLanguage],
                                  })
                            }
                            hitSlop={8}
                            onPress={(event) => {
                              event.stopPropagation();
                              toggleCityExpanded(item.group.cityKey);
                            }}
                            style={styles.zoneChevronButton}
                          >
                            <IconSymbol
                              name={item.expanded ? "chevron.down" : "chevron.right"}
                              size={16}
                              color={
                                isFullySelected
                                  ? (palette.onPrimary as string)
                                  : (palette.textMuted as string)
                              }
                            />
                          </KitPressable>
                        ) : null}
                      </View>
                    </KitPressable>
                  );
                }}
              />
            </View>
          </BottomSheet>

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: BrandSpacing.lg,
              right: BrandSpacing.lg,
              bottom: overlayBottom,
              zIndex: 30,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              {zoneModeActive ? (
                <>
                  <KitButton
                    label={t("mapTab.mobile.cancel")}
                    onPress={handleDiscardChanges}
                    disabled={isSaving}
                    variant="secondary"
                    fullWidth={false}
                    leadingIcon={<IconSymbol name="xmark" size={16} color={palette.text} />}
                    style={{ backgroundColor: palette.surface as string }}
                  />
                  <KitButton
                    label={
                      isSaving
                        ? t("mapTab.mobile.saveCoverageSaving")
                        : t("mapTab.mobile.saveCoverage")
                    }
                    onPress={() => {
                      void handleSaveZones();
                    }}
                    disabled={!hasChanges || isSaving}
                    fullWidth={false}
                    leadingIcon={
                      <IconSymbol name="checkmark" size={16} color={palette.onPrimary} />
                    }
                  />
                </>
              ) : (
                <KitButton
                  label={t("mapTab.mobile.editCoverage")}
                  onPress={openZoneEditor}
                  fullWidth={false}
                  leadingIcon={
                    <IconSymbol name="slider.horizontal.3" size={16} color={palette.onPrimary} />
                  }
                />
              )}
            </View>
          </View>
        </>
      ) : null}
    </View>
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
  emptyZoneSearchState: {
    borderRadius: 20,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 4,
    marginHorizontal: 16,
    marginTop: 4,
  },
  zoneCityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  zoneCityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 12,
  },
  zoneChevronButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneChildRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingLeft: 22,
    paddingRight: 18,
    paddingVertical: 14,
    marginLeft: 34,
    marginRight: 16,
    marginBottom: 8,
    gap: 12,
  },
  zoneChildBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
