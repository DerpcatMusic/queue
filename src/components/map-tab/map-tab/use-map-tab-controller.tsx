import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { createContentDrivenTopSheetConfig } from "@/components/layout/top-sheet-registry";
import { MapSheetResults } from "@/components/map-tab/map/map-sheet-results";
import { MapSheetHeader } from "@/components/map-tab/map-tab/map-sheet-header";
import { buildZoneCityGroups, buildZoneCityListItems } from "@/components/map-tab/zone-city-tree";

import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";

import { useThemePreference } from "@/hooks/use-theme-preference";
import {
  buildFilteredZones,
  countPendingZoneSelectionChanges,
  hasZoneSelectionChanges,
} from "./use-map-tab-controller.helpers";

const MAX_ZONES = 25;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xl;
const STATIC_ZONE_CITY_GROUPS = buildZoneCityGroups(ZONE_OPTIONS);
const STATIC_ZONE_BY_ID = new Map(ZONE_OPTIONS.map((zone) => [zone.id, zone]));
const STATIC_ZONE_CITY_BY_ZONE_ID = new Map<string, string>();
const STATIC_ZONE_CITY_GROUP_BY_KEY = new Map(
  STATIC_ZONE_CITY_GROUPS.map((group) => [group.cityKey, group]),
);

for (const group of STATIC_ZONE_CITY_GROUPS) {
  for (const zone of group.zones) {
    STATIC_ZONE_CITY_BY_ZONE_ID.set(zone.id, group.cityKey);
  }
}

export function useMapTabController() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const { overlayBottom } = useAppInsets();
  const isFocused = useIsFocused();
  // Deferred mount removed - map always ready once focused
  const isMapBodyReady = isFocused;
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const zoneLanguage: "en" | "he" = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he")
    ? "he"
    : "en";
  const { currentUser } = useUser();
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const remoteStudios = useQuery(
    api.users.getInstructorMapStudios,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  type RemoteStudio = NonNullable<typeof remoteStudios>[number];

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [sheetStep, setSheetStep] = useState(0);
  const [zoneSearch, setZoneSearch] = useState("");
  const [expandedCityKeys, setExpandedCityKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [mapPin] = useState<QueueMapPin | null>(null);

  const noopMapPress = useCallback(() => {}, []);
  const openSearchSheet = useCallback(() => {
    setSheetStep(2);
  }, []);

  const handleFocusSelection = useCallback(() => {
    const nextFocusZoneId = focusZoneId ?? selectedZoneIds[0] ?? remoteZones?.zoneIds?.[0] ?? null;
    if (!nextFocusZoneId) return;
    setFocusZoneId(nextFocusZoneId);
  }, [focusZoneId, remoteZones?.zoneIds, selectedZoneIds]);

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

  const hasChanges = useMemo(
    () => hasZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );
  const deferredSelectedZoneSet = useMemo(() => new Set(selectedZoneIds), [selectedZoneIds]);
  const expandedCityKeySet = useMemo(() => new Set(expandedCityKeys), [expandedCityKeys]);
  const filteredZones = useMemo(
    () => (Platform.OS === "web" ? buildFilteredZones(ZONE_OPTIONS, zoneSearch, zoneLanguage) : []),
    [zoneLanguage, zoneSearch],
  );
  const shouldBuildZoneCityItems =
    isSheetExpanded || zoneModeActive || zoneSearch.trim().length > 0;
  const zoneCityItems = useMemo(
    () =>
      shouldBuildZoneCityItems
        ? buildZoneCityListItems({
            groups: STATIC_ZONE_CITY_GROUPS,
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
      zoneLanguage,
      zoneSearch,
    ],
  );
  const allStudios = useMemo<StudioMapMarker[]>(
    () =>
      ((remoteStudios ?? []) as RemoteStudio[]).map((studio) => ({
        ...studio,
        studioId: String(studio.studioId),
      })),
    [remoteStudios],
  );
  const selectedZones = useMemo(
    () =>
      selectedZoneIds
        .map((zoneId) => STATIC_ZONE_BY_ID.get(zoneId))
        .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone)),
    [selectedZoneIds],
  );
  const visibleStudioMarkers = useMemo<StudioMapMarker[]>(
    () =>
      allStudios.filter(
        (studio) =>
          !zoneModeActive &&
          (selectedZoneIds.length > 0 ? selectedZoneIds.includes(studio.zone) : true),
      ),
    [allStudios, selectedZoneIds, zoneModeActive],
  );
  const studioCountByZone = useMemo(() => {
    const counts = new Map<string, number>();
    for (const studio of allStudios) {
      counts.set(studio.zone, (counts.get(studio.zone) ?? 0) + 1);
    }
    return counts;
  }, [allStudios]);
  const studioById = useMemo(
    () => new Map<string, StudioMapMarker>(allStudios.map((studio) => [studio.studioId, studio])),
    [allStudios],
  );
  const selectedStudio = useMemo(
    () => (selectedStudioId ? (studioById.get(selectedStudioId) ?? null) : null),
    [selectedStudioId, studioById],
  );
  const focusedZone = useMemo(
    () => (focusZoneId ? (STATIC_ZONE_BY_ID.get(focusZoneId) ?? null) : null),
    [focusZoneId],
  );
  const focusedZoneLabel = focusedZone?.label[zoneLanguage] ?? null;
  const focusedZoneStudioCount = useMemo(
    () => (focusZoneId ? (studioCountByZone.get(focusZoneId) ?? 0) : 0),
    [focusZoneId, studioCountByZone],
  );
  const pendingChangeCount = useMemo(
    () => countPendingZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );

  useEffect(() => {
    if (!zoneModeActive) {
      return;
    }
    setSelectedStudioId(null);
    setExpandedCityKeys((current) => {
      const next = new Set(current);
      for (const zoneId of selectedZoneIds) {
        const cityKey = STATIC_ZONE_CITY_BY_ZONE_ID.get(zoneId);
        if (cityKey) {
          next.add(cityKey);
        }
      }
      if (focusZoneId) {
        const cityKey = STATIC_ZONE_CITY_BY_ZONE_ID.get(focusZoneId);
        if (cityKey) {
          next.add(cityKey);
        }
      }
      return next.size === current.length ? current : [...next];
    });
  }, [focusZoneId, selectedZoneIds, zoneModeActive]);

  useEffect(() => {
    if (!selectedStudioId) {
      return;
    }
    if (!visibleStudioMarkers.some((studio) => studio.studioId === selectedStudioId)) {
      setSelectedStudioId(null);
    }
  }, [selectedStudioId, visibleStudioMarkers]);

  const toggleCityExpanded = useCallback((cityKey: string) => {
    setExpandedCityKeys((current) =>
      current.includes(cityKey)
        ? current.filter((entry) => entry !== cityKey)
        : [...current, cityKey],
    );
  }, []);

  const toggleCity = useCallback(
    (cityKey: string) => {
      const group = STATIC_ZONE_CITY_GROUP_BY_KEY.get(cityKey);
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
    [applySelectedZoneIds, selectedZoneIds],
  );

  const openZoneEditor = useCallback(() => {
    setSaveError(null);
    setZoneModeActive(true);
  }, []);

  const handleMapSheetSearchChange = useCallback((text: string) => {
    setZoneSearch(text);
    if (text.trim().length > 0) {
      setSheetStep(2);
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
    if (isSaving) {
      return;
    }
    if (zoneModeActive) {
      void confirmZoneSelection();
      return;
    }
    openZoneEditor();
  }, [confirmZoneSelection, isSaving, openZoneEditor, zoneModeActive]);

  const handleSheetStepChange = useCallback((step: number) => {
    setSheetStep(step);
  }, []);

  const handleSelectStudio = useCallback(
    (studioId: string) => {
      if (zoneModeActive) {
        return;
      }
      setSelectedStudioId(studioId);
    },
    [zoneModeActive],
  );

  const handleCloseStudio = useCallback(() => {
    setSelectedStudioId(null);
  }, []);

  const handleZoneResultPress = useCallback(
    (zoneId: string) => {
      toggleZone(zoneId);
    },
    [toggleZone],
  );

  const handleCityResultPress = useCallback(
    (cityKey: string) => {
      toggleCity(cityKey);
    },
    [toggleCity],
  );

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
        onPressZone={handleZoneResultPress}
        onPressCity={handleCityResultPress}
        onToggleCityExpanded={toggleCityExpanded}
      />
    ),
    [
      handleCityResultPress,
      handleZoneResultPress,
      isSheetExpanded,
      saveError,
      toggleCityExpanded,
      zoneCityItems,
      zoneLanguage,
      zoneModeActive,
    ],
  );

  const mapSheetConfig = useMemo(() => {
    const mapSheetBackgroundColor = theme.color.surface;
    return createContentDrivenTopSheetConfig({
      stickyHeader: (
        <MapSheetHeader
          focusZoneId={focusZoneId}
          onChangeSearch={handleMapSheetSearchChange}
          onFocusSearch={openSearchSheet}
          mapPalette={mapPalette}
          selectedZones={selectedZones}
          onPressZone={setFocusZoneId}
          t={t}
          zoneLanguage={zoneLanguage}
          zoneSearch={zoneSearch}
        />
      ),
      expandedContent: mapExpandedResults,
      activeStep: sheetStep,
      onStepChange: handleSheetStepChange,
      backgroundColor: mapSheetBackgroundColor,
      topInsetColor: mapSheetBackgroundColor,
      padding: {
        vertical: 2,
        horizontal: BrandSpacing.lg,
      },
      draggable: true,
      expandable: true,
      steps: [0, 0.5, 0.9],
      expandMode: "overlay",
      style: {
        borderColor: mapSheetBackgroundColor,
        borderBottomColor: mapSheetBackgroundColor,
        borderLeftColor: mapSheetBackgroundColor,
        borderRightColor: mapSheetBackgroundColor,
      },
    });
  }, [
    focusZoneId,
    handleMapSheetSearchChange,
    handleSheetStepChange,
    mapExpandedResults,
    theme.color.surface,
    openSearchSheet,
    selectedZones,
    sheetStep,
    t,
    zoneLanguage,
    zoneSearch,
    mapPalette,
  ]);

  return {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    focusedZoneStudioCount,
    handleDiscardChanges,
    handleCloseStudio,
    handleEditButtonPress,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleSaveZones,
    handleSelectStudio,
    hasChanges,
    isFocused,
    isMapBodyReady,
    isSaving,
    mapCameraPadding,
    mapPalette,
    mapPin,
    studios: visibleStudioMarkers,
    noopMapPress,
    overlayBottom,
    pendingChangeCount,
    persistedZoneIds,
    remoteZones,
    saveError,
    selectedStudio,
    selectedStudioId,
    selectedZoneIds,
    selectedZones,
    setFocusZoneId,
    t,
    toggleZone,
    mapSheetConfig,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  };
}
