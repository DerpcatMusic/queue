import type { TFunction } from "i18next";
import { View } from "react-native";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin, StudioMapMarker } from "@/components/maps/queue-map.types";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type MapMobileStageProps = {
  t: TFunction;
  mapBackgroundColor: string;
  isFocused: boolean;
  mapPin: QueueMapPin | null;
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
  onPressStudio: (studioId: string) => void;
  onPressZone: (zoneId: string) => void;
  onPressMap: () => void;
  onEditToggle: () => void;
};

export function MapMobileStage({
  t,
  mapBackgroundColor,
  isFocused,
  mapPin,
  selectedZoneIds: selectedZoneIdsProp,
  focusZoneId: focusZoneIdProp,
  zoneModeActive,
  isSaving,
  overlayBottom,
  cameraPadding,
  studios,
  onPressStudio,
  onPressZone,
  onPressMap,
  onEditToggle,
}: MapMobileStageProps) {
  const theme = useTheme();
  const selectedZoneIds = selectedZoneIdsProp;
  const focusZoneId = focusZoneIdProp;
  const handleZonePress = onPressZone;

  if (!isFocused) {
    return <View style={{ flex: 1, backgroundColor: mapBackgroundColor }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: mapBackgroundColor }}>
      <QueueMap
        mode="zoneSelect"
        pin={mapPin}
        selectedZoneIds={selectedZoneIds}
        focusZoneId={focusZoneId}
        isEditing={zoneModeActive}
        cameraPadding={cameraPadding}
        studios={studios}
        onPressStudio={onPressStudio}
        onPressZone={handleZonePress}
        onPressMap={onPressMap}
        showGpsButton={false}
        showAttributionButton
      />

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
    </View>
  );
}
