import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import { MapChromeButton } from "@/components/map-tab/map/map-chrome-button";
import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { MapSheetResults } from "@/components/map-tab/map/map-sheet-results";
import { buildZoneCityGroups, buildZoneCityListItems } from "@/components/map-tab/zone-city-tree";
import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, BrandType, getMapBrandPalette } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { resolveCurrentLocationToZone } from "@/lib/location-zone";

const MAX_ZONES = 25;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xxl + BrandSpacing.xl;
const MAP_HEADER_TO_STRIP_GAP = BrandSpacing.lg;
const MAP_FLOATING_BUTTON_GAP = BrandSpacing.md;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const { overlayBottom } = useAppInsets();
  const isFocused = useIsFocused();
  const isMapBodyReady = useDeferredTabMount(isFocused, { delayMs: 72 });
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const zoneLanguage = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he") ? "he" : "en";
  const { currentUser } = useUser();
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [sheetStep, setSheetStep] = useState(0);
  const [zoneSearch, setZoneSearch] = useState("");
  const [expandedCityKeys, setExpandedCityKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [mapPin, setMapPin] = useState<QueueMapPin | null>(null);
  const noopMapPress = useCallback(() => {}, []);
  const openSearchSheet = useCallback(() => {
    setSheetStep(1);
  }, []);
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
    (
      nextZoneIds: string[],
      preferredFocusZoneId?: string | null,
      options?: { allowNullFocus?: boolean },
    ) => {
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
        if (options?.allowNullFocus && preferredFocusZoneId === null) {
          return null;
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
      const preferredFocusZoneId = isSelected
        ? focusZoneId === zoneId
          ? null
          : undefined
        : zoneId;
      applySelectedZoneIds(nextZoneIds, preferredFocusZoneId, {
        allowNullFocus: isSelected && focusZoneId === zoneId,
      });
    },
    [applySelectedZoneIds, focusZoneId, selectedZoneIds],
  );

  const persistedZoneIds = (remoteZones?.zoneIds ?? []) as string[];

  const hasChanges = useMemo(() => {
    if (persistedZoneIds.length !== selectedZoneIds.length) return true;
    const currentSet = new Set(selectedZoneIds);
    return persistedZoneIds.some((id) => !currentSet.has(id));
  }, [persistedZoneIds, selectedZoneIds]);
  const deferredSelectedZoneSet = useMemo(() => new Set(selectedZoneIds), [selectedZoneIds]);
  const expandedCityKeySet = useMemo(() => new Set(expandedCityKeys), [expandedCityKeys]);
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
    const q = zoneSearch.trim().toLowerCase();
    if (!q) return ZONE_OPTIONS;
    return ZONE_OPTIONS.filter((zone) => {
      const label = zone.label[zoneLanguage].toLowerCase();
      const fallback = zone.label.en.toLowerCase();
      const id = zone.id.toLowerCase();
      return label.includes(q) || fallback.includes(q) || id.includes(q);
    });
  }, [zoneLanguage, zoneSearch]);
  const zoneCityItems = useMemo(
    () =>
      buildZoneCityListItems({
        groups: zoneCityGroups,
        language: zoneLanguage,
        query: zoneSearch,
        expandedCityKeys: expandedCityKeySet,
        selectedZoneIds: deferredSelectedZoneSet,
      }),
    [deferredSelectedZoneSet, expandedCityKeySet, zoneCityGroups, zoneLanguage, zoneSearch],
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
  }, []);

  const handleMapSheetSearchChange = useCallback((text: string) => {
    setZoneSearch(text);
    if (text.trim().length > 0) {
      setSheetStep(1);
    }
  }, []);

  const persistZoneSelection = useCallback(async () => {
    const nextZoneIds = [...selectedZoneIds];
    if (hasChanges && isSaving) return false;

    if (!hasChanges) {
      setFocusZoneId(nextZoneIds[0] ?? null);
      return true;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveZones({ zoneIds: nextZoneIds });
      setFocusZoneId(nextZoneIds[0] ?? null);
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message ? error.message : t("mapTab.errors.failedToSave"),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, isSaving, saveZones, selectedZoneIds, t]);

  const closeZoneEditor = useCallback(() => {
    setZoneModeActive(false);
  }, []);

  const confirmZoneSelection = useCallback(async () => {
    const didPersist = await persistZoneSelection();
    if (didPersist) {
      closeZoneEditor();
      return true;
    }
    setZoneModeActive(true);
    return false;
  }, [closeZoneEditor, persistZoneSelection]);

  const handleDiscardChanges = useCallback(() => {
    setSelectedZoneIds(persistedZoneIds);
    setFocusZoneId(persistedZoneIds[0] ?? null);
    setSaveError(null);
    closeZoneEditor();
  }, [closeZoneEditor, persistedZoneIds]);

  const handleSaveZones = useCallback(async () => {
    await confirmZoneSelection();
  }, [confirmZoneSelection]);

  const handleEditButtonPress = useCallback(() => {
    if (zoneModeActive) {
      void confirmZoneSelection();
      return;
    }
    openZoneEditor();
  }, [confirmZoneSelection, openZoneEditor, zoneModeActive]);

  const handleSheetStepChange = useCallback((step: number) => {
    setSheetStep(step);
  }, []);

  const isSheetExpanded = sheetStep > 0;
  const handleZoneResultPress = useCallback(
    (zoneId: string) => {
      if (zoneModeActive) {
        toggleZone(zoneId);
        return;
      }
      setFocusZoneId(zoneId);
    },
    [toggleZone, zoneModeActive],
  );
  const handleCityResultPress = useCallback(
    (cityKey: string) => {
      if (zoneModeActive) {
        toggleCity(cityKey);
        return;
      }
      toggleCityExpanded(cityKey);
    },
    [toggleCity, toggleCityExpanded, zoneModeActive],
  );
  const handleMapUtilityPress = useCallback(() => {
    if (focusedZone || selectedZoneIds.length > 0) {
      handleFocusSelection();
      return;
    }
    void handleUseGps();
  }, [focusedZone, handleFocusSelection, handleUseGps, selectedZoneIds.length]);
  const mapCameraPadding = useMemo(
    () => ({
      top: collapsedSheetHeight + MAP_CAMERA_TOP_OFFSET,
      right: BrandSpacing.lg,
      bottom: overlayBottom + MAP_CAMERA_BOTTOM_OFFSET,
      left: BrandSpacing.lg,
    }),
    [collapsedSheetHeight, overlayBottom],
  );
  const mapExpandedResults = useMemo(
    () => (
      <MapSheetResults
        isVisible={isSheetExpanded}
        saveError={saveError}
        zoneCityItems={zoneCityItems}
        zoneLanguage={zoneLanguage}
        zoneModeActive={zoneModeActive}
        palette={palette}
        onPressZone={handleZoneResultPress}
        onPressCity={handleCityResultPress}
        onToggleCityExpanded={toggleCityExpanded}
      />
    ),
    [
      isSheetExpanded,
      handleCityResultPress,
      handleZoneResultPress,
      palette,
      saveError,
      toggleCityExpanded,
      zoneCityItems,
      zoneModeActive,
      zoneLanguage,
    ],
  );

  const mapSheetConfig = useMemo(
    () => ({
      render: () => ({
        stickyHeader: (
          <View style={{ gap: MAP_HEADER_TO_STRIP_GAP }}>
            <NativeSearchField
              value={zoneSearch}
              onChangeText={handleMapSheetSearchChange}
              onFocus={openSearchSheet}
              placeholder={t("mapTab.searchPlaceholder")}
              clearAccessibilityLabel={t("common.clear")}
            />
            <MapSelectedZonesStrip
              selectedZones={selectedZones}
              focusZoneId={focusZoneId}
              zoneLanguage={zoneLanguage}
              palette={palette}
              onPressZone={setFocusZoneId}
            />
          </View>
        ),
        revealOnExpand: mapExpandedResults,
        activeStep: sheetStep,
        onStepChange: handleSheetStepChange,
        backgroundColor: palette.surfaceElevated as string,
        topInsetColor: palette.surfaceElevated as string,
        padding: {
          vertical: BrandSpacing.xs,
          horizontal: BrandSpacing.lg,
        },
      }),
      draggable: true,
      expandable: true,
      steps: [0.18, 0.52],
      initialStep: 0,
      activeStep: sheetStep,
      expandMode: "overlay" as const,
      backgroundColor: palette.surfaceElevated as string,
      topInsetColor: palette.surfaceElevated as string,
    }),
    [
      handleSheetStepChange,
      handleMapSheetSearchChange,
      mapExpandedResults,
      openSearchSheet,
      palette,
      selectedZones,
      sheetStep,
      t,
      focusZoneId,
      zoneLanguage,
      zoneSearch,
    ],
  );

  useGlobalTopSheet("map", Platform.OS === "web" ? null : mapSheetConfig);

  if (currentUser === undefined) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="sheet"
        style={{ backgroundColor: mapPalette.styleBackground }}
      >
        <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }} />
      </TabScreenRoot>
    );
  }

  if (!currentUser) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/studio" />;
  }

  if (!isMapBodyReady || remoteZones === undefined) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="sheet"
        style={{ backgroundColor: mapPalette.styleBackground }}
      >
        <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }} />
      </TabScreenRoot>
    );
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
                <ActionButton
                  label={t("mapTab.web.saveCoverage")}
                  onPress={() => {
                    void handleSaveZones();
                  }}
                  disabled={!hasChanges || isSaving}
                  loading={isSaving}
                  palette={palette}
                  tone="secondary"
                />
                <ActionButton
                  label={t("mapTab.web.resetToLive")}
                  onPress={handleDiscardChanges}
                  disabled={!hasChanges || isSaving}
                  palette={palette}
                  tone="secondary"
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
                      {t("mapTab.web.left", {
                        count: MAX_ZONES - selectedZoneIds.length,
                      })}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {focusedZone
                    ? t("mapTab.web.focusPinned", {
                        zone: focusedZone.label[zoneLanguage],
                      })
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
                      <Pressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setFocusZoneId(zone.id);
                        }}
                        style={({ pressed }) => ({
                          borderRadius: 22,
                          borderCurve: "continuous",
                          backgroundColor:
                            focusZoneId === zone.id
                              ? (palette.primary as string)
                              : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 14,
                          opacity: pressed ? 0.92 : 1,
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
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("mapTab.mobile.removeZone", {
                              zone: zone.label[zoneLanguage],
                            })}
                            onPress={() => toggleZone(zone.id)}
                            style={({ pressed }) => ({
                              borderRadius: 999,
                              backgroundColor:
                                focusZoneId === zone.id
                                  ? "rgba(255,255,255,0.14)"
                                  : (palette.surfaceAlt as string),
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              opacity: pressed ? 0.88 : 1,
                            })}
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
                          </Pressable>
                        </View>
                      </Pressable>
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
                      <Pressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => toggleZone(zone.id)}
                        style={({ pressed }) => ({
                          borderRadius: 20,
                          borderCurve: "continuous",
                          backgroundColor: selected
                            ? (palette.primary as string)
                            : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          opacity: pressed ? 0.92 : 1,
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
                      </Pressable>
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
    <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }}>
      {isFocused ? (
        <>
          <QueueMap
            mode="zoneSelect"
            pin={mapPin}
            selectedZoneIds={selectedZoneIds}
            focusZoneId={focusZoneId}
            isEditing={zoneModeActive}
            cameraPadding={mapCameraPadding}
            {...(zoneModeActive ? { onPressZone: toggleZone } : {})}
            onPressMap={noopMapPress}
            showGpsButton={false}
            showAttributionButton
          />

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              bottom: overlayBottom + BrandSpacing.xxl,
              right: BrandSpacing.lg,
              zIndex: 60,
            }}
          >
            <View style={{ gap: MAP_FLOATING_BUTTON_GAP }}>
              <MapChromeButton
                icon="location.north.line.fill"
                label={t("mapTab.actions.refocus")}
                onPress={() => {
                  handleMapUtilityPress();
                }}
                palette={palette}
                disabled={isSaving}
              />
              <MapChromeButton
                icon={zoneModeActive ? "checkmark.circle.fill" : "square.and.pencil"}
                label={
                  zoneModeActive
                    ? t("mapTab.mobile.confirmCoverage")
                    : t("mapTab.mobile.editCoverage")
                }
                onPress={handleEditButtonPress}
                palette={palette}
                active={zoneModeActive}
                disabled={isSaving}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
