import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { MapSheetResults } from "@/components/map-tab/map/map-sheet-results";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import { buildZoneCityGroups, buildZoneCityListItems } from "@/components/map-tab/zone-city-tree";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { resolveCurrentLocationToZone } from "@/lib/location-zone";

const MAX_ZONES = 25;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xl;
const MAP_HEADER_TO_STRIP_GAP = BrandSpacing.xs;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const { overlayBottom } = useAppInsets();
  const isFocused = useIsFocused();
  const isMapBodyReady = useDeferredTabMount(isFocused, { delayMs: 36 });
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
  const isSheetExpanded = sheetStep > 0;

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
  const shouldBuildZoneCityItems =
    isSheetExpanded || zoneModeActive || zoneSearch.trim().length > 0;
  const zoneCityItems = useMemo(
    () =>
      shouldBuildZoneCityItems
        ? buildZoneCityListItems({
            groups: zoneCityGroups,
            language: zoneLanguage,
            query: zoneSearch,
            expandedCityKeys: expandedCityKeySet,
            selectedZoneIds: deferredSelectedZoneSet,
          })
        : [],
    [
      deferredSelectedZoneSet,
      expandedCityKeySet,
      shouldBuildZoneCityItems,
      zoneCityGroups,
      zoneLanguage,
      zoneSearch,
    ],
  );
  const selectedZones = useMemo(
    () => ZONE_OPTIONS.filter((zone) => deferredSelectedZoneSet.has(zone.id)),
    [deferredSelectedZoneSet],
  );
  const focusedZone = useMemo(
    () => ZONE_OPTIONS.find((zone) => zone.id === focusZoneId) ?? null,
    [focusZoneId],
  );
  const focusedZoneLabel = focusedZone?.label[zoneLanguage] ?? null;
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
        backgroundColor: palette.surface as string,
        topInsetColor: palette.surface as string,
        padding: {
          vertical: BrandSpacing.xs,
          horizontal: BrandSpacing.lg,
        },
      }),
      draggable: true,
      expandable: true,
      steps: [0.28, 0.58, 0.94],
      initialStep: 0,
      activeStep: sheetStep,
      expandMode: "overlay" as const,
      backgroundColor: palette.surface as string,
      topInsetColor: palette.surface as string,
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
        <MapWebWorkbench
          t={t}
          palette={palette}
          zoneLanguage={zoneLanguage}
          zoneSearch={zoneSearch}
          selectedZones={selectedZones}
          filteredZones={filteredZones}
          focusZoneId={focusZoneId}
          focusedZoneLabel={focusedZoneLabel}
          mapPin={mapPin}
          hasChanges={hasChanges}
          pendingChangeCount={pendingChangeCount}
          persistedZoneCount={persistedZoneIds.length}
          isSaving={isSaving}
          saveError={saveError}
          onToggleZone={toggleZone}
          onSetFocusZone={setFocusZoneId}
          onHandleFocusSelection={handleFocusSelection}
          onHandleSaveZones={handleSaveZones}
          onHandleDiscardChanges={handleDiscardChanges}
          onSearchChange={handleMapSheetSearchChange}
        />
      </TabScreenRoot>
    );
  }

  return (
    <MapMobileStage
      t={t}
      palette={palette}
      mapBackgroundColor={mapPalette.styleBackground}
      isFocused={isFocused}
      mapPin={mapPin}
      selectedZoneIds={selectedZoneIds}
      focusZoneId={focusZoneId}
      zoneModeActive={zoneModeActive}
      isSaving={isSaving}
      overlayBottom={overlayBottom}
      cameraPadding={mapCameraPadding}
      onPressZone={toggleZone}
      onPressMap={noopMapPress}
      onRefocus={handleMapUtilityPress}
      onEditToggle={handleEditButtonPress}
    />
  );
}
