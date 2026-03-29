import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";

import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";

import { useThemePreference } from "@/hooks/use-theme-preference";
import {
  buildFilteredZones,
  countPendingZoneSelectionChanges,
  hasZoneSelectionChanges,
} from "./use-map-tab-controller.helpers";

const MAX_ZONES = 25;
const MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl;
const MAP_CAMERA_BOTTOM_OFFSET = BrandSpacing.xl;
const STATIC_ZONE_BY_ID = new Map(ZONE_OPTIONS.map((zone) => [zone.id, zone]));

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
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [mapPin] = useState<QueueMapPin | null>(null);

  const noopMapPress = useCallback(() => {}, []);

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

  const hasChanges = useMemo(
    () => hasZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );
  const filteredZones = useMemo(
    () => (Platform.OS === "web" ? buildFilteredZones(ZONE_OPTIONS, zoneSearch, zoneLanguage) : []),
    [zoneLanguage, zoneSearch],
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
      ((remoteStudios ?? []) as RemoteStudio[]).filter((studio: RemoteStudio) =>
        selectedZoneIds.length > 0 ? selectedZoneIds.includes(studio.zone) : true,
      ),
    [remoteStudios, selectedZoneIds],
  );
  const focusedZone = useMemo(
    () => (focusZoneId ? (STATIC_ZONE_BY_ID.get(focusZoneId) ?? null) : null),
    [focusZoneId],
  );
  const focusedZoneLabel = focusedZone?.label[zoneLanguage] ?? null;
  const pendingChangeCount = useMemo(
    () => countPendingZoneSelectionChanges(persistedZoneIds, selectedZoneIds),
    [persistedZoneIds, selectedZoneIds],
  );

  const openZoneEditor = useCallback(() => {
    setSaveError(null);
    setZoneModeActive(true);
  }, []);

  const handleMapSheetSearchChange = useCallback((text: string) => {
    setZoneSearch(text);
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

  const mapCameraPadding = useMemo(
    () => ({
      top: collapsedSheetHeight + MAP_CAMERA_TOP_OFFSET,
      right: BrandSpacing.lg,
      bottom: overlayBottom + MAP_CAMERA_BOTTOM_OFFSET,
      left: BrandSpacing.lg,
    }),
    [collapsedSheetHeight, overlayBottom],
  );

  return {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    handleDiscardChanges,
    handleEditButtonPress,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleSaveZones,
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
    selectedZoneIds,
    selectedZones,
    setFocusZoneId,
    t,
    toggleZone,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  };
}
