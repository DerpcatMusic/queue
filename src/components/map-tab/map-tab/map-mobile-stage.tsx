import type { TFunction } from "i18next";
import { View } from "react-native";

import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandSpacing } from "@/constants/brand";

type MapMobileStageProps = {
  t: TFunction;
  palette: BrandPalette;
  mapBackgroundColor: string;
  isFocused: boolean;
  mapPin: QueueMapPin | null;
  studios: StudioMapMarker[];
  selectedZoneIds: string[];
  focusZoneId: string | null;
  zoneModeActive: boolean;
  isSaving: boolean;
  cameraPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  onPressZone: (zoneId: string) => void;
  onPressMap: () => void;
  onPressStudio: (studioId: string) => void;
  onEditToggle: () => void;
};

export function MapMobileStage({
  t,
  palette,
  mapBackgroundColor,
  isFocused,
  mapPin,
  studios,
  selectedZoneIds,
  focusZoneId,
  zoneModeActive,
  isSaving,
  cameraPadding,
  onPressZone,
  onPressMap,
  onPressStudio,
  onEditToggle,
}: MapMobileStageProps) {
  if (!isFocused) {
    return <View style={{ flex: 1, backgroundColor: mapBackgroundColor }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: mapBackgroundColor }}>
      <QueueMap
        mode="zoneSelect"
        pin={mapPin}
        studios={studios}
        selectedZoneIds={selectedZoneIds}
        focusZoneId={focusZoneId}
        isEditing={zoneModeActive}
        cameraPadding={cameraPadding}
        onPressZone={onPressZone}
        onPressMap={onPressMap}
        onPressStudio={onPressStudio}
        showGpsButton={false}
        showAttributionButton
      />

      <TabOverlayAnchor side="right" offset={BrandSpacing.lg} style={{ zIndex: 60 }}>
        <IconButton
          accessibilityLabel={
            zoneModeActive ? t("mapTab.mobile.confirmCoverage") : t("mapTab.mobile.editCoverage")
          }
          onPress={onEditToggle}
          tone={zoneModeActive ? "primary" : "primarySubtle"}
          size={58}
          disabled={isSaving}
          backgroundColorOverride={
            zoneModeActive ? (palette.primary as string) : (palette.surface as string)
          }
          icon={
            <IconSymbol
              name={zoneModeActive ? "checkmark.circle.fill" : "slider.horizontal.3"}
              size={22}
              color={zoneModeActive ? (palette.onPrimary as string) : (palette.primary as string)}
            />
          }
        />
      </TabOverlayAnchor>
    </View>
  );
}
