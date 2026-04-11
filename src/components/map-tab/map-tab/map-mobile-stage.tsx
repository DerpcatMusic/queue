import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
} from "react-native-reanimated";
import { memo, useContext } from "react";
import type { TFunction } from "i18next";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { MapRadiusControl } from "@/components/map-tab/map-radius-control";
import { QueueMap } from "@/components/maps/queue-map";
import type {
  QueueMapBounds,
  QueueMapPin,
  StudioMapMarker,
} from "@/components/maps/queue-map.types";
import type { BoundaryGeometrySource, BoundaryViewportTarget } from "@/features/maps/boundaries/types";
import { StudioMapDetailModal } from "@/components/maps/studio-map-detail-modal";
import { TabTransitionContext } from "@/modules/navigation/role-tabs-layout";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

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
  overlayBottom: number;
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
  studioCount: number;
  isRadiusPanelOpen: boolean;
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
  overlayBottom,
  cameraPadding,
  studios,
  selectedStudio,
  selectedStudioId,
  zoneLanguage,
  showRadiusControl,
  workRadiusKm,
  studioCount,
  isRadiusPanelOpen,
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

      {isMapReady && showRadiusControl && isRadiusPanelOpen ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: BrandSpacing.lg,
            left: BrandSpacing.lg,
            right: BrandSpacing.lg,
            zIndex: 70,
          }}
        >
          <MapRadiusControl
            radiusKm={workRadiusKm}
            studiosCount={studioCount}
            isSaving={isRadiusSaving}
            onRadiusChange={onRadiusChange}
            onRadiusCommit={onRadiusCommit}
          />
        </Animated.View>
      ) : null}

      {showRadiusControl ? (
        <TabOverlayAnchor
          side="right"
          offset={BrandSpacing.lg}
          style={{ bottom: (overlayBottom ?? BrandSpacing.lg) + BrandSpacing.xs, zIndex: 60 }}
        >
          <IconButton
            accessibilityLabel={
              isRadiusPanelOpen ? t("common.save") : t("mapTab.mobile.openRadius")
            }
            onPress={() => {
              if (isRadiusPanelOpen) {
                onRadiusCommit(workRadiusKm);
                onRadiusPanelToggle();
                return;
              }
              onRadiusPanelToggle();
            }}
            tone={isRadiusPanelOpen ? "primary" : "secondary"}
            size={58}
            disabled={isRadiusSaving}
            icon={
              <IconSymbol
                name={isRadiusPanelOpen ? "checkmark.circle.fill" : "pencil"}
                size={22}
                color={isRadiusPanelOpen ? theme.color.onPrimary : theme.color.primary}
              />
            }
          />
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
