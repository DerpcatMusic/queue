import type { TFunction } from "i18next";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandSpacing } from "@/constants/brand";

type MapMobileStageProps = {
  t: TFunction;
  palette: BrandPalette;
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
  onPressZone: (zoneId: string) => void;
  onPressMap: () => void;
  onRefocus: () => void;
  onEditToggle: () => void;
};

export function MapMobileStage({
  t,
  palette,
  mapBackgroundColor,
  isFocused,
  mapPin,
  selectedZoneIds,
  focusZoneId,
  zoneModeActive,
  isSaving,
  overlayBottom,
  cameraPadding,
  onPressZone,
  onPressMap,
  onRefocus,
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
        selectedZoneIds={selectedZoneIds}
        focusZoneId={focusZoneId}
        isEditing={zoneModeActive}
        cameraPadding={cameraPadding}
        {...(zoneModeActive ? { onPressZone } : {})}
        onPressMap={onPressMap}
        showGpsButton={false}
        showAttributionButton
      />

      <View
        pointerEvents="box-none"
        style={
          {
            position: "absolute",
            bottom: overlayBottom + BrandSpacing.xxl,
            right: BrandSpacing.lg,
            zIndex: 60,
          } satisfies ViewStyle
        }
      >
        <View style={{ gap: BrandSpacing.md }}>
          <IconButton
            accessibilityLabel={t("mapTab.actions.refocus")}
            onPress={onRefocus}
            tone="secondary"
            size={56}
            disabled={isSaving}
            icon={
              <IconSymbol
                name="location.north.line.fill"
                size={20}
                color={palette.text as string}
              />
            }
          />
          <IconButton
            accessibilityLabel={
              zoneModeActive ? t("mapTab.mobile.confirmCoverage") : t("mapTab.mobile.editCoverage")
            }
            onPress={onEditToggle}
            tone={zoneModeActive ? "primary" : "secondary"}
            size={56}
            disabled={isSaving}
            icon={
              <IconSymbol
                name={zoneModeActive ? "checkmark.circle.fill" : "square.and.pencil"}
                size={20}
                color={zoneModeActive ? (palette.onPrimary as string) : (palette.text as string)}
              />
            }
          />
        </View>
      </View>
    </View>
  );
}
