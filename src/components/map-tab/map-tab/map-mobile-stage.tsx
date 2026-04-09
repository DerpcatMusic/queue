import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { memo, useContext } from "react";
import type { TFunction } from "i18next";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { QueueMap } from "@/components/maps/queue-map";
import type {
  QueueMapBounds,
  QueueMapPin,
  StudioMapMarker,
} from "@/components/maps/queue-map.types";
import type { BoundaryGeometrySource, BoundaryViewportTarget } from "@/features/maps/boundaries/types";
import { StudioMapDetailModal } from "@/components/maps/studio-map-detail-modal";
import { ZoneStudioSummary } from "@/components/maps/zone-studio-summary";
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
  zoneModeActive: boolean;
  isSaving: boolean;
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
  focusedZoneLabel: string | null;
  focusedZoneStudioCount: number;
  zoneLanguage: "en" | "he";
  onPressStudio: (studioId: string) => void;
  onCloseStudio: () => void;
  onOpenStudioProfile: (studioId: string) => void;
  onPressZone: (zoneId: string) => void;
  onPressMap: () => void;
  onEditToggle: () => void;
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
  zoneModeActive,
  isSaving,
  overlayBottom,
  cameraPadding,
  studios,
  selectedStudio,
  selectedStudioId,
  focusedZoneLabel,
  focusedZoneStudioCount,
  zoneLanguage,
  onPressStudio,
  onCloseStudio,
  onOpenStudioProfile,
  onPressZone,
  onPressMap,
  onEditToggle,
}: MapMobileStageProps) {
  const theme = useTheme();
  const selectedZoneIds = selectedZoneIdsProp;
  const focusZoneId = focusZoneIdProp;
  const handleZonePress = onPressZone;
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
          mode="zoneSelect"
          pin={mapPin}
          selectedZoneIds={selectedZoneIds}
          focusZoneId={focusZoneId}
          selectedBoundaryIds={selectedZoneIds}
          focusBoundaryId={focusZoneId}
          isEditing={zoneModeActive}
          cameraPadding={cameraPadding}
          studios={studios}
          selectedStudioId={selectedStudioId}
          onPressStudio={onPressStudio}
          onPressBoundary={handleZonePress}
          onPressZone={handleZonePress}
          onPressMap={onPressMap}
          showGpsButton={false}
          showAttributionButton={false}
          {...(boundarySource ? { boundarySource } : {})}
          {...(boundaryIdProperty ? { boundaryIdProperty } : {})}
          {...(boundaryLabelPropertyCandidates ? { boundaryLabelPropertyCandidates } : {})}
          {...(boundaryInteractionBounds ? { boundaryInteractionBounds } : {})}
          {...(focusBoundaryBounds ? { focusBoundaryBounds } : {})}
          {...(initialBoundaryViewport ? { initialBoundaryViewport } : {})}
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

      <TabOverlayAnchor
        side="right"
        offset={BrandSpacing.lg}
        style={{ bottom: (overlayBottom ?? BrandSpacing.lg) + BrandSpacing.xs, zIndex: 60 }}
      >
        <IconButton
          accessibilityLabel={
            zoneModeActive ? t("mapTab.mobile.confirmCoverage") : t("mapTab.mobile.editCoverage")
          }
          onPress={onEditToggle}
          tone={zoneModeActive ? "primary" : "secondary"}
          size={58}
          disabled={isSaving}
          icon={
            <IconSymbol
              name={zoneModeActive ? "checkmark.circle.fill" : "pencil"}
              size={22}
              color={zoneModeActive ? theme.color.onPrimary : theme.color.primary}
            />
          }
        />
      </TabOverlayAnchor>

      {zoneModeActive && focusedZoneLabel ? (
        <TabOverlayAnchor
          side="left"
          offset={BrandSpacing.lg}
          style={{
            bottom: (overlayBottom ?? BrandSpacing.lg) + BrandSpacing.xxl + BrandSpacing.lg,
          }}
        >
          <ZoneStudioSummary zoneLabel={focusedZoneLabel} count={focusedZoneStudioCount} />
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
