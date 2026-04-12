import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
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
const MAX_MAP_RADIUS_KM = 40;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xl;

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
  const zoneLanguage: "en" | "he" = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he")
    ? "he"
    : "en";
  const { currentUser } = useUser();
  const [draftWorkRadiusKm, setDraftWorkRadiusKm] = useState(DEFAULT_WORK_RADIUS_KM);
  const [committedWorkRadiusKm, setCommittedWorkRadiusKm] = useState(DEFAULT_WORK_RADIUS_KM);
  const [hasSeededWorkRadius, setHasSeededWorkRadius] = useState(false);
  const [hasUserAdjustedWorkRadius, setHasUserAdjustedWorkRadius] = useState(false);
  const [isRadiusSaving, setIsRadiusSaving] = useState(false);
  const radiusSaveQueueRef = useRef<number | null>(null);
  const pendingRadiusSaveRef = useRef<number | null>(null);
  const boundaryOptions = ZONE_OPTIONS as readonly ZoneOption[];
  const boundaryById = useMemo(
    () => new Map(boundaryOptions.map((boundary) => [boundary.id, boundary])),
    [boundaryOptions],
  );
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [persistedZoneIds, setPersistedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [mapPin, setMapPin] = useState<QueueMapPin | null>(null);
  const [hasAttemptedMapPinBootstrap, setHasAttemptedMapPinBootstrap] = useState(false);
  const [isRadiusPanelOpen, setIsRadiusPanelOpen] = useState(false);
  const [focusFrameKey, setFocusFrameKey] = useState(0);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructorSettings = useMutation(api.users.updateMyInstructorSettings);
  const remoteStudios = useQuery(
    api.users.getInstructorMapStudios,
    currentUser?.role === "instructor" ? { workRadiusKm: MAX_MAP_RADIUS_KM } : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  type RemoteStudio = NonNullable<typeof remoteStudios>[number];

  const noopMapPress = useCallback(() => {}, []);

  const handleFocusSelection = useCallback(() => {
    const nextFocusZoneId = focusZoneId ?? selectedZoneIds[0] ?? persistedZoneIds[0] ?? null;
    if (!nextFocusZoneId) return;
    setFocusZoneId(nextFocusZoneId);
  }, [focusZoneId, persistedZoneIds, selectedZoneIds]);

  useEffect(() => {
    if (!remoteZones) return;
    const nextZoneIds = remoteZones.zoneIds ?? [];
    setSelectedZoneIds(nextZoneIds);
    setPersistedZoneIds(nextZoneIds);
  }, [remoteZones]);

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
    const pendingRadiusKm = pendingRadiusSaveRef.current;
    if (pendingRadiusKm === null || !instructorSettings || isRadiusSaving) {
      return;
    }
    pendingRadiusSaveRef.current = null;
    void saveRadiusToProfile(pendingRadiusKm);
  }, [instructorSettings, isRadiusSaving]);

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
    if (!isFocused) {
      return;
    }
    setFocusFrameKey((current) => current + 1);
  }, [isFocused]);

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
      if (!instructorSettings) {
        pendingRadiusSaveRef.current = radiusKm;
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
          return;
        }
        const pendingRadiusKm = pendingRadiusSaveRef.current;
        if (pendingRadiusKm !== null) {
          pendingRadiusSaveRef.current = null;
          void saveRadiusToProfile(pendingRadiusKm);
        }
      }
    },
    [instructorSettings, isRadiusSaving, saveInstructorSettings],
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
      await saveZones({ zoneIds: nextZoneIds });
      setPersistedZoneIds(nextZoneIds);
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
    hasChanges,
    isSaving,
    saveZones,
    selectedZoneIds,
    t,
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
    selectedZones,
    workRadiusKm: draftWorkRadiusKm,
    committedWorkRadiusKm,
    showRadiusControl: true,
    isRadiusSaving,
    handleRadiusChange,
    handleRadiusCommit,
    handleRadiusPanelToggle,
    focusFrameKey,
    setFocusZoneId,
    t,
    toggleZone,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  };
}
