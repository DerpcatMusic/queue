import { api } from "@/convex/_generated/api";
import { LoadingScreen } from "@/components/loading-screen";
import { InstructorZonesMap } from "@/components/maps/instructor-zones-map";
import {
  buildZoneSelectionViewModel,
  isKnownZoneId,
  sanitizeZoneIds,
} from "@/components/map-tab/zone-selection-model";
import { ThemedText } from "@/components/themed-text";
import { KitFab, KitSurface } from "@/components/ui/kit";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useBrand } from "@/hooks/use-brand";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_ZONES = 25;
const EMPTY_ZONE_SELECTION_VIEW_MODEL: {
  filteredCityGroups: ReturnType<typeof buildZoneSelectionViewModel>["filteredCityGroups"];
  zoneListRows: ReturnType<typeof buildZoneSelectionViewModel>["zoneListRows"];
  previewZoneIds: string[];
} = {
  filteredCityGroups: [],
  zoneListRows: [],
  previewZoneIds: [],
};

const MAP_ERROR_TO_TRANSLATION_KEY: Record<string, string> = {
  "At least one zone is required": "mapTab.errors.selectAtLeastOneZone",
  "Invalid zone id": "mapTab.errors.invalidZone",
  "Too many zones selected": "mapTab.errors.tooManyZones",
};
const LazyMapZoneModeSheet = lazy(() =>
  import("@/components/map-tab/zone-mode-sheet").then((module) => ({
    default: module.MapZoneModeSheet,
  })),
);

function getMapErrorMessage(message: string, t: (key: string) => string) {
  const mappedKey = MAP_ERROR_TO_TRANSLATION_KEY[message];
  return mappedKey ? t(mappedKey) : message;
}

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const insets = useSafeAreaInsets();
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const isRtl = i18n.dir(i18n.resolvedLanguage) === "rtl";
  const isExpoGoNative =
    Platform.OS !== "web" && Constants.appOwnership === "expo";

  const currentUser = useQuery(api.users.getCurrentUser);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isZoneModeEnabled, setIsZoneModeEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCityKeys, setExpandedCityKeys] = useState<string[]>([]);
  const [mapSelectionLevel, setMapSelectionLevel] = useState<"city" | "zone">("city");
  const [mapZoomLevel, setMapZoomLevel] = useState<number | null>(null);
  const showMapDebug = __DEV__;

  const bottomSheetRef = useRef<BottomSheet | null>(null);
  const zoneModeBaselineIdsRef = useRef<string[]>([]);
  const debugZoomFrameRef = useRef<number | null>(null);
  const pendingDebugZoomRef = useRef<number | null>(null);
  const firstInteractiveLoggedRef = useRef(false);
  const firstInteractiveTimerRef = useRef<(() => void) | null>(
    FEATURE_FLAGS.mapPerfTelemetry ? createPerfTimer("map.first_interactive") : null,
  );

  useEffect(() => {
    if (!remoteZones || isDirty) return;
    const sanitizedZoneIds = sanitizeZoneIds(remoteZones.zoneIds);
    setSelectedZoneIds(sanitizedZoneIds);
    if (sanitizedZoneIds.length !== remoteZones.zoneIds.length) {
      setIsDirty(true);
    }
  }, [isDirty, remoteZones]);

  useEffect(() => {
    if (!isZoneModeEnabled) {
      setZoneSearch("");
    }
  }, [isZoneModeEnabled]);

  useEffect(() => {
    return () => {
      if (debugZoomFrameRef.current !== null) {
        cancelAnimationFrame(debugZoomFrameRef.current);
      }
      if (FEATURE_FLAGS.mapPerfTelemetry) {
        logPerfSummary();
      }
    };
  }, []);

  const deferredZoneSearch = useDeferredValue(zoneSearch);
  const deferredSelectedZoneIds = useDeferredValue(selectedZoneIds);
  const deferredMapSelectedZoneIds = useDeferredValue(selectedZoneIds);

  const zoneSelectionViewModel = useMemo(
    () => {
      if (!isZoneModeEnabled) {
        return EMPTY_ZONE_SELECTION_VIEW_MODEL;
      }
      const startedAt = FEATURE_FLAGS.mapPerfTelemetry ? performance.now() : 0;
      const viewModel = buildZoneSelectionViewModel({
        expandedCityKeys,
        isZoneModeEnabled,
        language,
        selectedZoneIds: deferredSelectedZoneIds,
        zoneSearch: deferredZoneSearch,
      });
      if (FEATURE_FLAGS.mapPerfTelemetry) {
        const durationMs = performance.now() - startedAt;
        recordPerfMetric("map.zone_sheet_model_compute", durationMs, {
          rows: viewModel.zoneListRows.length,
          selectedCount: deferredSelectedZoneIds.length,
          queryLength: deferredZoneSearch.trim().length,
        });
      }
      return viewModel;
    },
    [
      deferredSelectedZoneIds,
      deferredZoneSearch,
      expandedCityKeys,
      isZoneModeEnabled,
      language,
    ],
  );
  const { previewZoneIds, zoneListRows } = zoneSelectionViewModel;
  const deferredPreviewZoneIds = useDeferredValue(previewZoneIds);

  const instructorSettings = useQuery(api.users.getMyInstructorSettings);
  const userLocation = useMemo(() => {
    if (instructorSettings?.latitude && instructorSettings?.longitude) {
      return {
        latitude: instructorSettings.latitude,
        longitude: instructorSettings.longitude,
      };
    }
    return null;
  }, [instructorSettings]);

  const handleSelectionLevelChange = useCallback((level: "city" | "zone") => {
    setMapSelectionLevel(level);
  }, []);

  const handleZoomLevelChange = useCallback(
    (zoomLevel: number) => {
      if (!showMapDebug) return;
      pendingDebugZoomRef.current = zoomLevel;
      if (debugZoomFrameRef.current !== null) return;

      debugZoomFrameRef.current = requestAnimationFrame(() => {
        debugZoomFrameRef.current = null;
        const nextZoom = pendingDebugZoomRef.current;
        if (typeof nextZoom !== "number" || Number.isNaN(nextZoom)) return;
        setMapZoomLevel((current) => {
          if (current !== null && Math.abs(current - nextZoom) < 0.02) {
            return current;
          }
          return nextZoom;
        });
      });
    },
    [showMapDebug],
  );

  const toggleZone = useCallback(
    (zoneId: string) => {
      if (!isKnownZoneId(zoneId)) return;
      const stopTimer = FEATURE_FLAGS.mapPerfTelemetry
        ? createPerfTimer("map.zone_toggle_latency", { selectionLevel: mapSelectionLevel })
        : null;

      setErrorMessage(null);
      setSelectedZoneIds((current) => {
        if (current.includes(zoneId)) {
          setIsDirty(true);
          return current.filter((id) => id !== zoneId);
        }
        if (current.length >= MAX_ZONES) {
          setErrorMessage(t("mapTab.errors.tooManyZones"));
          return current;
        }
        setIsDirty(true);
        return [...current, zoneId];
      });

      if (stopTimer) {
        requestAnimationFrame(() => {
          stopTimer();
        });
      }
    },
    [mapSelectionLevel, t],
  );

  const toggleZoneIds = useCallback(
    (zoneIds: string[]) => {
      const stopTimer = FEATURE_FLAGS.mapPerfTelemetry
        ? createPerfTimer("map.city_toggle_latency", { selectionLevel: mapSelectionLevel })
        : null;

      setErrorMessage(null);
      setSelectedZoneIds((current) => {
        const selected = new Set(current);
        const allSelected = zoneIds.every((zoneId) => selected.has(zoneId));

        if (allSelected) {
          setIsDirty(true);
          const zoneIdsSet = new Set(zoneIds);
          return current.filter((zoneId) => !zoneIdsSet.has(zoneId));
        }

        const idsToAdd = zoneIds.filter((zoneId) => !selected.has(zoneId));
        if (current.length + idsToAdd.length > MAX_ZONES) {
          setErrorMessage(t("mapTab.errors.tooManyZones"));
          return current;
        }

        setIsDirty(true);
        return [...current, ...idsToAdd];
      });

      if (stopTimer) {
        requestAnimationFrame(() => {
          stopTimer();
        });
      }
    },
    [mapSelectionLevel, t],
  );

  const toggleCityExpanded = useCallback((cityKey: string) => {
    setExpandedCityKeys((current) =>
      current.includes(cityKey)
        ? current.filter((key) => key !== cityKey)
        : [...current, cityKey],
    );
  }, []);

  const persistSelection = useCallback(async () => {
    const sanitizedZoneIds = sanitizeZoneIds(selectedZoneIds);
    if (sanitizedZoneIds.length !== selectedZoneIds.length) {
      setSelectedZoneIds(sanitizedZoneIds);
      setIsDirty(true);
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveZones({ zoneIds: sanitizedZoneIds });
      setIsDirty(false);
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("mapTab.errors.failedToSave");
      setErrorMessage(getMapErrorMessage(message, t));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [saveZones, selectedZoneIds, t]);

  const resetZoneModeUi = useCallback(() => {
    setIsZoneModeEnabled(false);
    setZoneSearch("");
    setExpandedCityKeys([]);
  }, []);

  const openZoneMode = useCallback(() => {
    zoneModeBaselineIdsRef.current = [...selectedZoneIds];
    setErrorMessage(null);
    setExpandedCityKeys([]);
    setIsZoneModeEnabled(true);
  }, [selectedZoneIds]);

  const discardZoneModeChanges = useCallback(() => {
    setSelectedZoneIds([...zoneModeBaselineIdsRef.current]);
    setErrorMessage(null);
    setIsDirty(false);
    resetZoneModeUi();
  }, [resetZoneModeUi]);

  const saveAndCloseZoneMode = useCallback(async () => {
    if (isSaving) return;
    if (isDirty) {
      const saved = await persistSelection();
      if (!saved) return;
    }
    setErrorMessage(null);
    resetZoneModeUi();
  }, [isDirty, isSaving, persistSelection, resetZoneModeUi]);

  const mapCanvas = useMemo(
    () => (
      <InstructorZonesMap
        zoneMode={isZoneModeEnabled}
        selectedZoneIds={deferredMapSelectedZoneIds}
        previewZoneIds={deferredPreviewZoneIds}
        focusZoneId={null}
        onPressZone={toggleZone}
        onPressCity={toggleZoneIds}
        onSelectionLevelChange={handleSelectionLevelChange}
        onZoomLevelChange={handleZoomLevelChange}
        userLocation={userLocation}
      />
    ),
    [
      handleSelectionLevelChange,
      handleZoomLevelChange,
      deferredMapSelectedZoneIds,
      deferredPreviewZoneIds,
      isZoneModeEnabled,
      toggleZone,
      toggleZoneIds,
      userLocation,
    ],
  );

  const selectedZonesLabel = t("mapTab.selectedZones", {
    count: selectedZoneIds.length,
  });

  if (currentUser === undefined) {
    return <LoadingScreen label={t("mapTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/" />;
  }

  if (remoteZones === undefined) {
    return <LoadingScreen label={t("mapTab.loading")} />;
  }

  if (
    FEATURE_FLAGS.mapPerfTelemetry &&
    !firstInteractiveLoggedRef.current &&
    currentUser?.role === "instructor" &&
    remoteZones !== undefined
  ) {
    firstInteractiveTimerRef.current?.();
    firstInteractiveLoggedRef.current = true;
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <StatusBar style="auto" />
      <View style={styles.mapWrap}>
        {isExpoGoNative ? (
          <View
            style={[
              styles.expoGoWrap,
              { paddingTop: insets.top, paddingBottom: 24 },
            ]}
          >
            <KitSurface tone="sunken">
              <ThemedText type="defaultSemiBold">
                {t("mapTab.devBuildRequiredTitle")}
              </ThemedText>
              <ThemedText style={{ color: palette.textMuted }}>
                {t("mapTab.devBuildRequiredBody")}
              </ThemedText>
            </KitSurface>
          </View>
        ) : (
          <>
            {mapCanvas}

            <View
              pointerEvents="none"
              style={[
                styles.mapOverlay,
                {
                  top: insets.top + 12,
                  left: 12,
                  right: 12,
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.mapOverlayHeader}>
                <ThemedText type="title">{t("mapTab.title")}</ThemedText>
                <ThemedText
                  type="micro"
                  style={{
                    color: isZoneModeEnabled ? palette.primary : palette.textMuted,
                  }}
                >
                  {isZoneModeEnabled
                    ? t("mapTab.zoneModeOn")
                    : t("mapTab.zoneModeOff")}
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {t("mapTab.subtitle")}
              </ThemedText>
              <ThemedText
                selectable
                type="micro"
                style={{ color: palette.textMuted, fontVariant: ["tabular-nums"] }}
              >
                {selectedZonesLabel}
              </ThemedText>
            </View>

            {showMapDebug ? (
              <View
                pointerEvents="none"
                style={[
                  styles.debugPanel,
                  {
                    top: insets.top + 12,
                    [isRtl ? "right" : "left"]: 12,
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <ThemedText type="defaultSemiBold">Map Debug</ThemedText>
                <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
                  Zoom: {mapZoomLevel === null ? "--" : mapZoomLevel.toFixed(2)}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
                  Mode: {isZoneModeEnabled ? "zone" : "browse"} / {mapSelectionLevel}
                </ThemedText>
              </View>
            ) : null}

            {isZoneModeEnabled ? (
              <Suspense fallback={null}>
                <LazyMapZoneModeSheet
                  bottomSheetRef={bottomSheetRef}
                  errorMessage={errorMessage}
                  insets={insets}
                  isDirty={isDirty}
                  isRtl={isRtl}
                  isSaving={isSaving}
                  language={language}
                  mapSelectionLevel={mapSelectionLevel}
                  onDiscard={discardZoneModeChanges}
                  onSaveAndClose={() => {
                    void saveAndCloseZoneMode();
                  }}
                  onToggleCityExpanded={toggleCityExpanded}
                  onToggleZone={toggleZone}
                  onToggleZoneIds={toggleZoneIds}
                  palette={palette}
                  selectedZoneCount={selectedZoneIds.length}
                  t={t}
                  zoneListRows={zoneListRows}
                  zoneSearch={zoneSearch}
                  onZoneSearchChange={setZoneSearch}
                />
              </Suspense>
            ) : null}

            <KitFab
              selected={isZoneModeEnabled}
              disabled={isSaving}
              {...(selectedZoneIds.length > 0
                ? { badgeLabel: String(selectedZoneIds.length) }
                : {})}
              style={[
                styles.selectFab,
                {
                  bottom: Math.max(insets.bottom, 24),
                  [isRtl ? "left" : "right"]: 16,
                  opacity: isSaving ? 0.72 : 1,
                },
              ]}
              onPress={() => {
                if (isZoneModeEnabled) {
                  void saveAndCloseZoneMode();
                  return;
                }
                openZoneMode();
              }}
              icon={
                <IconSymbol
                  name={
                    isZoneModeEnabled
                      ? "checkmark.circle.fill"
                      : "slider.horizontal.3"
                  }
                  size={24}
                  color={isZoneModeEnabled ? palette.onPrimary : palette.text}
                />
              }
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mapWrap: {
    flex: 1,
  },
  mapOverlay: {
    position: "absolute",
    zIndex: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  mapOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  expoGoWrap: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  selectFab: {
    position: "absolute",
    overflow: "visible",
    zIndex: 12,
  },
  debugPanel: {
    position: "absolute",
    zIndex: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
});


