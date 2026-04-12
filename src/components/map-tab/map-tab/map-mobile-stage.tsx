import { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { memo, useContext } from "react";
import type { TFunction } from "i18next";
import { MapRadiusControl } from "@/components/map-tab/map-radius-control";
import { QueueMap } from "@/components/maps/queue-map";
import type {
  QueueMapBounds,
  QueueMapPin,
  StudioMapMarker,
} from "@/components/maps/queue-map.types";
import type { BoundaryGeometrySource, BoundaryViewportTarget } from "@/features/maps/boundaries/types";
import { StudioMapDetailModal } from "@/components/maps/studio-map-detail-modal";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabTransitionContext } from "@/modules/navigation/role-tabs-layout";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

const RADIUS_ACTION_SIZE = BrandSpacing.iconButtonSize + BrandSpacing.xs;
const RADIUS_TRAY_MIN_HEIGHT = RADIUS_ACTION_SIZE + BrandSpacing.lg;

type MapMobileStageProps = {
  t: TFunction;
  mapBackgroundColor: string;
  isFocused: boolean;
  mapPin: QueueMapPin | null;
  boundarySource?: BoundaryGeometrySource;
  boundaryIdProperty?: string;
  boundaryLabelPropertyCandidates?: string[];
  boundaryInteractionBounds?: QueueMapBounds | null;
  focusBoundaryBounds?: QueueMapBounds | null;
  initialBoundaryViewport?: BoundaryViewportTarget | null;
  selectedZoneIds: string[];
  focusZoneId: string | null;
  isRadiusSaving: boolean;
  cameraPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  studios: StudioMapMarker[];
  selectedStudio: StudioMapMarker | null;
  selectedStudioId: string | null;
  zoneLanguage: "en" | "he";
  showRadiusControl: boolean;
  workRadiusKm: number;
  isRadiusPanelOpen: boolean;
  focusFrameKey: number;
  onPressStudio: (studioId: string) => void;
  onCloseStudio: () => void;
  onOpenStudioProfile: (studioId: string) => void;
  onPressMap: () => void;
  onRadiusChange: (radiusKm: number) => void;
  onRadiusCommit: (radiusKm: number) => void;
  onRadiusPanelToggle: () => void;
};

export const MapMobileStage = memo(function MapMobileStage({
  t,
  mapBackgroundColor,
  isFocused,
  mapPin,
  boundarySource,
  boundaryIdProperty,
  boundaryLabelPropertyCandidates,
  boundaryInteractionBounds,
  focusBoundaryBounds,
  initialBoundaryViewport,
  selectedZoneIds: selectedZoneIdsProp,
  focusZoneId: focusZoneIdProp,
  isRadiusSaving,
  cameraPadding,
  studios,
  selectedStudio,
  selectedStudioId,
  zoneLanguage,
  showRadiusControl,
  workRadiusKm,
  isRadiusPanelOpen,
  focusFrameKey,
  onPressStudio,
  onCloseStudio,
  onOpenStudioProfile,
  onPressMap,
  onRadiusChange,
  onRadiusCommit,
  onRadiusPanelToggle,
}: MapMobileStageProps) {
  const theme = useTheme();
  const selectedZoneIds = showRadiusControl ? [] : selectedZoneIdsProp;
  const focusZoneId = showRadiusControl ? null : focusZoneIdProp;
  const { focusProgress } = useContext(TabTransitionContext)!;

  // Deferred map mount: QueueMap only renders after the tab transition animation
  // completes (focusProgress === 1). This keeps the tab switch smooth — MapLibre
  // initialization is deferred so it can't block the 260ms tab transition.
  const [isMapReady, setIsMapReady] = useState(false);
  const [radiusTrayHeight, setRadiusTrayHeight] = useState(0);
  const [isTrayMounted, setIsTrayMounted] = useState(isRadiusPanelOpen);
  const trayTranslateY = useSharedValue(0);
  const trayOpacity = useSharedValue(0);
  const trayCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set map ready immediately if the tab is already active (first mount)
  useEffect(() => {
    if (focusProgress.value === 1) {
      setIsMapReady(true);
    }
  }, [focusProgress]);

  // When tab transition completes (focusProgress → 1), mark map as ready.
  // This fires whether coming from another tab or cold-mounting directly.
  useAnimatedReaction(
    () => focusProgress.value,
    (currentValue, previousValue) => {
      if (previousValue !== 1 && currentValue === 1) {
        runOnJS(setIsMapReady)(true);
      }
    },
    [focusProgress],
  );

  const trayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: trayOpacity.value,
    transform: [{ translateY: trayTranslateY.value }],
  }));

  useEffect(() => {
    if (trayCloseTimeoutRef.current) {
      clearTimeout(trayCloseTimeoutRef.current);
      trayCloseTimeoutRef.current = null;
    }

    if (!isMapReady || !showRadiusControl) {
      setIsTrayMounted(false);
      trayOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
      trayTranslateY.value = withTiming(
        radiusTrayHeight > 0 ? radiusTrayHeight + BrandSpacing.md : BrandSpacing.xxl,
        { duration: 160, easing: Easing.in(Easing.cubic) },
      );
      return;
    }

    if (isRadiusPanelOpen) {
      setIsTrayMounted(true);
      trayOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
      trayTranslateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }

    if (!isTrayMounted) {
      return;
    }

    trayOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    trayTranslateY.value = withTiming(
      radiusTrayHeight > 0 ? radiusTrayHeight + BrandSpacing.md : BrandSpacing.xxl,
      { duration: 180, easing: Easing.in(Easing.cubic) },
    );
    trayCloseTimeoutRef.current = setTimeout(() => {
      setIsTrayMounted(false);
    }, 180);
  }, [
    isMapReady,
    isRadiusPanelOpen,
    isTrayMounted,
    radiusTrayHeight,
    showRadiusControl,
    trayOpacity,
    trayTranslateY,
  ]);

  useEffect(
    () => () => {
      if (trayCloseTimeoutRef.current) {
        clearTimeout(trayCloseTimeoutRef.current);
      }
    },
    [],
  );

  if (!isFocused) {
    return <Box style={{ flex: 1, backgroundColor: mapBackgroundColor }} />;
  }

  return (
    <Box style={{ flex: 1, backgroundColor: mapBackgroundColor }}>
      {isMapReady ? (
        <QueueMap
          mode={showRadiusControl ? "pinDrop" : "zoneSelect"}
          pin={mapPin}
          selectedZoneIds={selectedZoneIds}
          focusZoneId={focusZoneId}
          selectedBoundaryIds={showRadiusControl ? [] : selectedZoneIds}
          focusBoundaryId={showRadiusControl ? null : focusZoneId}
          isEditing={false}
          cameraPadding={cameraPadding}
          focusFrameKey={focusFrameKey}
          studios={studios}
          selectedStudioId={selectedStudioId}
          onPressStudio={onPressStudio}
          onPressMap={onPressMap}
          {...(showRadiusControl ? { radiusKm: workRadiusKm } : {})}
          showGpsButton={false}
          showAttributionButton={false}
          {...(!showRadiusControl && boundarySource ? { boundarySource } : {})}
          {...(!showRadiusControl && boundaryIdProperty ? { boundaryIdProperty } : {})}
          {...(!showRadiusControl && boundaryLabelPropertyCandidates
            ? { boundaryLabelPropertyCandidates }
            : {})}
          {...(!showRadiusControl && boundaryInteractionBounds
            ? { boundaryInteractionBounds }
            : {})}
          {...(!showRadiusControl && focusBoundaryBounds ? { focusBoundaryBounds } : {})}
          {...(!showRadiusControl && initialBoundaryViewport ? { initialBoundaryViewport } : {})}
        />
      ) : (
        // Skeleton shown during tab transition — MapLibre hasn't mounted yet.
        // Shows background color so there's no visual flash when map appears.
        <Box style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Box
            style={{
              width: BrandSpacing.controlMd,
              height: BrandSpacing.controlMd,
              borderRadius: BrandRadius.mapMarker,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.color.surfaceElevated,
              borderWidth: 1,
              borderColor: theme.color.borderStrong,
            }}
          >
            <ActivityIndicator color={theme.color.primary} />
          </Box>
        </Box>
      )}

      {showRadiusControl ? (
        <TabOverlayAnchor
          side="left"
          offset={BrandSpacing.lg}
          style={{ left: BrandSpacing.lg, right: BrandSpacing.lg, zIndex: 80 }}
        >
          <Box style={styles.radiusDockRow}>
            <Box style={styles.radiusTrayDock}>
              {isMapReady && isTrayMounted ? (
                <Animated.View
                  key={focusFrameKey}
                  pointerEvents="box-none"
                  onLayout={(event) => {
                    setRadiusTrayHeight(Math.round(event.nativeEvent.layout.height));
                  }}
                  style={[styles.radiusTrayShell, trayAnimatedStyle]}
                >
                  <Box
                    style={[
                      styles.radiusTray,
                      {
                        backgroundColor: theme.color.surface,
                        paddingHorizontal: BrandSpacing.lg,
                        paddingTop: BrandSpacing.sm,
                        paddingBottom: BrandSpacing.lg,
                        minHeight: RADIUS_TRAY_MIN_HEIGHT,
                      },
                    ]}
                  >
                    <Box style={styles.radiusTrayControlRow}>
                      <MapRadiusControl
                        radiusKm={workRadiusKm}
                        isSaving={isRadiusSaving}
                        style={{ flex: 1 }}
                        onRadiusChange={onRadiusChange}
                        onRadiusCommit={onRadiusCommit}
                      />
                    </Box>
                  </Box>
                </Animated.View>
              ) : null}
            </Box>

            <Box style={styles.radiusActionDock}>
              <IconButton
                accessibilityLabel={
                  isRadiusPanelOpen ? t("common.close") : t("mapTab.mobile.openRadius")
                }
                onPress={onRadiusPanelToggle}
                tone={isRadiusPanelOpen ? "primary" : "secondary"}
                size={RADIUS_ACTION_SIZE}
                disabled={isRadiusSaving}
                floating={isRadiusPanelOpen}
                backgroundColorOverride={
                  isRadiusPanelOpen ? theme.color.primary : theme.color.surface
                }
                icon={
                  <IconSymbol
                    name={isRadiusPanelOpen ? "checkmark" : "pencil"}
                    size={isRadiusPanelOpen ? 18 : 22}
                    color={isRadiusPanelOpen ? theme.color.onPrimary : theme.color.primary}
                  />
                }
              />
            </Box>
          </Box>
        </TabOverlayAnchor>
      ) : null}

      <StudioMapDetailModal
        studio={selectedStudio}
        zoneLanguage={zoneLanguage}
        onClose={onCloseStudio}
        onOpenStudio={onOpenStudioProfile}
      />
    </Box>
  );
});

const styles = {
  radiusTray: {
    borderTopLeftRadius: BrandRadius.soft,
    borderTopRightRadius: BrandRadius.soft,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderCurve: "continuous" as const,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  radiusTrayShell: {
    position: "relative" as const,
    alignSelf: "stretch" as const,
    minWidth: 0,
    zIndex: 70,
  },
  radiusDockRow: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: BrandSpacing.sm,
    minWidth: 0,
    width: "100%" as const,
  },
  radiusTrayDock: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch" as const,
  },
  radiusActionDock: {
    width: RADIUS_ACTION_SIZE,
    minWidth: RADIUS_ACTION_SIZE,
    paddingBottom: BrandSpacing.xxs,
  },
  radiusTrayControlRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: BrandSpacing.sm,
    minWidth: 0,
  },
};
