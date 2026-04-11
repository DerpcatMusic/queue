import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { buildZoneCityGroups } from "@/components/map-tab/zone-city-tree";

import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import {
  buildBoundariesForProvider,
  buildCityMetaForProvider,
  type SelectableBoundary,
} from "@/features/maps/boundaries/catalog";
import { LONDON_BOROUGH_BOUNDS_BY_ID } from "@/features/maps/boundaries/london-boroughs";
import {
  DEFAULT_BOUNDARY_PROVIDER,
  getBoundaryProviderForLocation,
} from "@/features/maps/boundaries/providers";
import { useAppInsets } from "@/hooks/use-app-insets";

import { useThemePreference } from "@/hooks/use-theme-preference";
import { captureCurrentLocationSample } from "@/lib/location-zone";
import {
  buildFilteredZones,
  countPendingZoneSelectionChanges,
  hasZoneSelectionChanges,
} from "./use-map-tab-controller.helpers";

const MAX_ZONES = 25;
const DEFAULT_WORK_RADIUS_KM = 15;
const MAX_MAP_RADIUS_KM = 50;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xl;

// Build boundary data from the active provider (derived inside component to avoid stale closures)
function buildProviderState(provider: typeof DEFAULT_BOUNDARY_PROVIDER) {
  const boundaryOptions = buildBoundariesForProvider(provider);
  const boundaryById = new Map<string, SelectableBoundary>(boundaryOptions.map((b) => [b.id, b]));
  const cityGroups = buildZoneCityGroups(boundaryOptions);
  const cityByZoneId = new Map<string, string>();
  const cityGroupByKey = new Map<string, (typeof cityGroups)[number]>();
  for (const group of cityGroups) {
    cityGroupByKey.set(group.cityKey, group);
    for (const zone of group.zones) {
      cityByZoneId.set(zone.id, group.cityKey);
    }
  }
  const cityMetaByKey = buildCityMetaForProvider(provider, boundaryOptions);
  return { boundaryOptions, boundaryById, cityGroups, cityByZoneId, cityGroupByKey, cityMetaByKey };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function filterStudiosWithinRadius(
  studios: readonly StudioMapMarker[],
  center: QueueMapPin | null,
  radiusKm: number,
) {
  if (!center) {
    return [...studios];
  }

  const maxDistanceMeters = Math.max(0, radiusKm) * 1000;
  return studios.filter((studio) => {
    const distanceMeters = getDistanceMeters(center, studio);
    return distanceMeters <= maxDistanceMeters;
  });
}

export function useMapTabController() {
  const { t, i18n } = useTranslation();
  const { resolvedScheme } = useThemePreference();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const { overlayBottom } = useAppInsets();
  const isFocused = useIsFocused();
  // Deferred mount removed - map always ready once focused
  const isMapBodyReady = isFocused;
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [activeProvider, setActiveProvider] = useState(DEFAULT_BOUNDARY_PROVIDER);
  const zoneLanguage: "en" | "he" = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he")
    ? "he"
    : "en";
  const activeBoundaryProvider = activeProvider.id;
  const usesLegacyZoneStorage = activeProvider.selectionStorage === "legacyZones";
  const { currentUser } = useUser();
  const [draftWorkRadiusKm, setDraftWorkRadiusKm] = useState(DEFAULT_WORK_RADIUS_KM);
  const [committedWorkRadiusKm, setCommittedWorkRadiusKm] = useState(DEFAULT_WORK_RADIUS_KM);
  const [hasSeededWorkRadius, setHasSeededWorkRadius] = useState(false);
  const [hasUserAdjustedWorkRadius, setHasUserAdjustedWorkRadius] = useState(false);
  const [isRadiusSaving, setIsRadiusSaving] = useState(false);
  const radiusSaveQueueRef = useRef<number | null>(null);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" && usesLegacyZoneStorage ? {} : "skip",
  );
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructorSettings = useMutation(api.users.updateMyInstructorSettings);
  const remoteBoundaries = useQuery(
    api.boundaries.getMyInstructorBoundaries,
    currentUser?.role === "instructor" && !usesLegacyZoneStorage
      ? { provider: activeBoundaryProvider }
      : "skip",
  );
  const remoteStudios = useQuery(
    api.users.getInstructorMapStudios,
    currentUser?.role === "instructor" ? { workRadiusKm: MAX_MAP_RADIUS_KM } : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);
  const saveBoundaries = useMutation(api.boundaries.setMyInstructorBoundaries);

  type RemoteStudio = NonNullable<typeof remoteStudios>[number];

  // Derive boundary data from active provider (dynamic based on provider)
  const { boundaryOptions, boundaryById } = useMemo(
    () => buildProviderState(activeProvider),
    [activeProvider],
  );

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [mapPin, setMapPin] = useState<QueueMapPin | null>(null);
  const [hasAttemptedMapPinBootstrap, setHasAttemptedMapPinBootstrap] = useState(false);
  const [isRadiusPanelOpen, setIsRadiusPanelOpen] = useState(true);

  const noopMapPress = useCallback(() => {}, []);

  const handleFocusSelection = useCallback(() => {
    const nextFocusZoneId = focusZoneId ?? selectedZoneIds[0] ?? remoteZones?.zoneIds?.[0] ?? null;
    if (!nextFocusZoneId) return;
    setFocusZoneId(nextFocusZoneId);
  }, [focusZoneId, remoteZones?.zoneIds, selectedZoneIds]);

  useEffect(() => {
    if (!usesLegacyZoneStorage) {
      if (!remoteBoundaries) return;
      setSelectedZoneIds(remoteBoundaries.boundaryIds ?? []);
      return;
    }

    if (!remoteZones) return;
    setSelectedZoneIds(remoteZones.zoneIds ?? []);
  }, [remoteBoundaries, remoteZones, usesLegacyZoneStorage]);

  useEffect(() => {
    if (hasSeededWorkRadius || hasUserAdjustedWorkRadius) {
      return;
    }
    if (!instructorSettings) {
      return;
    }
    const nextRadiusKm = instructorSettings.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM;
    setDraftWorkRadiusKm(nextRadiusKm);
    setCommittedWorkRadiusKm(nextRadiusKm);
    setHasSeededWorkRadius(true);
  }, [hasSeededWorkRadius, hasUserAdjustedWorkRadius, instructorSettings]);

  useEffect(() => {
    if (instructorSettings?.latitude == null || instructorSettings?.longitude == null) {
      return;
    }
    setMapPin((current) =>
      current ?? {
        latitude: instructorSettings.latitude!,
        longitude: instructorSettings.longitude!,
      },
    );
  }, [instructorSettings?.latitude, instructorSettings?.longitude]);

  useEffect(() => {
    if (!isFocused || hasAttemptedMapPinBootstrap || mapPin) {
      return;
    }

    setHasAttemptedMapPinBootstrap(true);
    let cancelled = false;

    void captureCurrentLocationSample()
      .then((sample) => {
        if (cancelled) return;
        setMapPin({
          latitude: sample.latitude,
          longitude: sample.longitude,
        });
      })
      .catch(() => {
        // Best-effort only. If location is unavailable, keep the default map center.
      });

    return () => {
      cancelled = true;
    };
  }, [hasAttemptedMapPinBootstrap, isFocused, mapPin]);

  useEffect(() => {
    if (!mapPin) return; // Need GPS location

    const detected = getBoundaryProviderForLocation(mapPin.longitude, mapPin.latitude);
    if (detected && detected.id !== activeProvider.id) {
      setActiveProvider(detected);
    }
  }, [mapPin, activeProvider.id]);

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

  const persistedZoneIds = ((usesLegacyZoneStorage
    ? remoteZones?.zoneIds
    : remoteBoundaries?.boundaryIds) ?? []) as string[];

  const hasChanges = useMemo(
    () => hasZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );
  const filteredZones = useMemo(
    () =>
      Platform.OS === "web" ? buildFilteredZones(boundaryOptions, zoneSearch, zoneLanguage) : [],
    [boundaryOptions, zoneLanguage, zoneSearch],
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
        .map((zoneId) => boundaryById.get(zoneId))
        .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone)),
    [boundaryById, selectedZoneIds],
  );
  const visibleStudioMarkers = useMemo<StudioMapMarker[]>(
    () => filterStudiosWithinRadius(allStudios, mapPin, committedWorkRadiusKm),
    [allStudios, committedWorkRadiusKm, mapPin],
  );
  const previewStudioMarkers = useMemo<StudioMapMarker[]>(
    () => filterStudiosWithinRadius(allStudios, mapPin, draftWorkRadiusKm),
    [allStudios, draftWorkRadiusKm, mapPin],
  );
  const studioById = useMemo(
    () => new Map<string, StudioMapMarker>(allStudios.map((studio) => [studio.studioId, studio])),
    [allStudios],
  );
  const selectedStudio = useMemo(
    () => (selectedStudioId ? (studioById.get(selectedStudioId) ?? null) : null),
    [selectedStudioId, studioById],
  );
  const focusedZone = useMemo(
    () => (focusZoneId ? (boundaryById.get(focusZoneId) ?? null) : null),
    [boundaryById, focusZoneId],
  );
  const focusBoundaryBounds = useMemo(() => {
    if (usesLegacyZoneStorage) return undefined;
    if (focusZoneId) {
      return LONDON_BOROUGH_BOUNDS_BY_ID.get(focusZoneId) ?? null;
    }
    return activeProvider.viewport?.bbox ?? null;
  }, [focusZoneId, usesLegacyZoneStorage, activeProvider]);
  const focusedZoneLabel = focusedZone?.label[zoneLanguage] ?? null;
  const pendingChangeCount = useMemo(
    () => countPendingZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );

  useEffect(() => {
    if (!selectedStudioId) {
      return;
    }
    if (!visibleStudioMarkers.some((studio) => studio.studioId === selectedStudioId)) {
      setSelectedStudioId(null);
    }
  }, [selectedStudioId, visibleStudioMarkers]);

  const saveRadiusToProfile = useCallback(
    async (radiusKm: number) => {
      if (usesLegacyZoneStorage || !instructorSettings) {
        return;
      }
      const currentRadiusKm = instructorSettings.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM;
      if (Math.abs(currentRadiusKm - radiusKm) < 0.001) {
        return;
      }

      if (isRadiusSaving) {
        radiusSaveQueueRef.current = radiusKm;
        return;
      }

      setIsRadiusSaving(true);
      try {
        await saveInstructorSettings({
          notificationsEnabled: instructorSettings.notificationsEnabled,
          sports: instructorSettings.sports,
          workRadiusKm: radiusKm,
          calendarProvider: instructorSettings.calendarProvider,
          calendarSyncEnabled: instructorSettings.calendarSyncEnabled,
          ...(instructorSettings.lessonReminderMinutesBefore !== undefined
            ? { lessonReminderMinutesBefore: instructorSettings.lessonReminderMinutesBefore }
            : {}),
          ...(instructorSettings.hourlyRateExpectation !== undefined
            ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation }
            : {}),
          ...(instructorSettings.address !== undefined ? { address: instructorSettings.address } : {}),
          ...(instructorSettings.addressCity !== undefined
            ? { addressCity: instructorSettings.addressCity }
            : {}),
          ...(instructorSettings.addressStreet !== undefined
            ? { addressStreet: instructorSettings.addressStreet }
            : {}),
          ...(instructorSettings.addressNumber !== undefined
            ? { addressNumber: instructorSettings.addressNumber }
            : {}),
          ...(instructorSettings.addressFloor !== undefined
            ? { addressFloor: instructorSettings.addressFloor }
            : {}),
          ...(instructorSettings.addressPostalCode !== undefined
            ? { addressPostalCode: instructorSettings.addressPostalCode }
            : {}),
          ...(instructorSettings.latitude !== undefined ? { latitude: instructorSettings.latitude } : {}),
          ...(instructorSettings.longitude !== undefined
            ? { longitude: instructorSettings.longitude }
            : {}),
        });
      } catch (error) {
        console.warn("Failed to save map radius", error);
      } finally {
        setIsRadiusSaving(false);
        const queuedRadius = radiusSaveQueueRef.current;
        radiusSaveQueueRef.current = null;
        if (queuedRadius !== null && Math.abs(queuedRadius - radiusKm) >= 0.001) {
          void saveRadiusToProfile(queuedRadius);
        }
      }
    },
    [instructorSettings, isRadiusSaving, saveInstructorSettings, usesLegacyZoneStorage],
  );

  const handleRadiusChange = useCallback((radiusKm: number) => {
    setHasUserAdjustedWorkRadius(true);
    setDraftWorkRadiusKm(radiusKm);
  }, []);

  const handleRadiusCommit = useCallback(
    (radiusKm: number) => {
      setDraftWorkRadiusKm(radiusKm);
      setCommittedWorkRadiusKm(radiusKm);
      void saveRadiusToProfile(radiusKm);
    },
    [saveRadiusToProfile],
  );

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
      if (!usesLegacyZoneStorage) {
        await saveBoundaries({
          provider: activeBoundaryProvider,
          boundaryIds: nextZoneIds,
        });
      } else {
        await saveZones({ zoneIds: nextZoneIds });
      }
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
  }, [
    activeBoundaryProvider,
    hasChanges,
    isSaving,
    saveBoundaries,
    saveZones,
    selectedZoneIds,
    t,
    usesLegacyZoneStorage,
  ]);

  const handleMapSheetSearchChange = useCallback((text: string) => {
    setZoneSearch(text);
  }, []);

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

  const mapCameraPadding = useMemo(
    () => ({
      top: collapsedSheetHeight + MAP_CAMERA_TOP_OFFSET,
      right: BrandSpacing.lg,
      bottom: overlayBottom + MAP_CAMERA_BOTTOM_OFFSET,
      left: BrandSpacing.lg,
    }),
    [collapsedSheetHeight, overlayBottom],
  );
  const handleRadiusPanelToggle = useCallback(() => {
    setIsRadiusPanelOpen((current) => !current);
  }, []);

  return {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    handleCloseStudio,
    handleFocusSelection,
    handleDiscardChanges,
    handleMapSheetSearchChange,
    handleSaveZones,
    handleSelectStudio,
    hasChanges,
    isFocused,
    isMapBodyReady,
    isSaving,
    isRadiusPanelOpen,
    mapCameraPadding,
    mapPalette,
    mapPin,
    activeBoundaryProvider,
    boundaryIdProperty:
      activeProvider.geometry.kind === "geojson" || activeProvider.geometry.kind === "remoteGeojson"
        ? activeProvider.geometry.idProperty
        : (activeProvider.geometry.promoteId ?? "id"),
    initialBoundaryViewport: !usesLegacyZoneStorage ? (activeProvider.viewport ?? null) : undefined,
    boundaryLabelPropertyCandidates: activeProvider.labelPropertyCandidates ?? ["name", "id"],
    boundarySource: !usesLegacyZoneStorage ? activeProvider.geometry : undefined,
    boundaryInteractionBounds: !usesLegacyZoneStorage
      ? (activeProvider.interactionBounds ?? activeProvider.viewport?.bbox ?? null)
      : undefined,
    focusBoundaryBounds,
    studios: visibleStudioMarkers,
    studioCount: previewStudioMarkers.length,
    noopMapPress,
    overlayBottom,
    pendingChangeCount,
    persistedZoneIds,
    remoteZones,
    saveError,
    selectedStudio,
    selectedStudioId,
    selectedZoneIds,
    selectedBoundaryIds: selectedZoneIds,
    selectedZones,
    workRadiusKm: draftWorkRadiusKm,
    committedWorkRadiusKm,
    showRadiusControl: true,
    isRadiusSaving,
    handleRadiusChange,
    handleRadiusCommit,
    handleRadiusPanelToggle,
    setFocusZoneId,
    t,
    toggleZone,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  };
}
