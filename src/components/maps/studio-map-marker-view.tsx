import { memo } from "react";

import type { StudioMapMarker } from "@/components/maps/queue-map.types";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";
import { BorderWidth } from "@/theme/theme";

export const STUDIO_MAP_MARKER_SIZE = BrandSpacing.avatarSm;
export const STUDIO_MAP_MARKER_OUTER_SIZE = STUDIO_MAP_MARKER_SIZE + BrandSpacing.xs * 2;

type StudioMapMarkerViewProps = {
  studio: StudioMapMarker;
  selected?: boolean;
};

const StudioMapMarkerViewBase = ({ studio, selected = false }: StudioMapMarkerViewProps) => {
  const { color } = useTheme();
  const markerSize = STUDIO_MAP_MARKER_SIZE;
  const outerSize = STUDIO_MAP_MARKER_OUTER_SIZE;
  const borderColor = studio.mapMarkerColor ?? color.primary;

  return (
    <Box
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: BrandRadius.full,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color.primarySubtle,
        borderWidth: selected ? BorderWidth.heavy : BorderWidth.medium,
        borderColor,
      }}
    >
      <ProfileAvatar
        imageUrl={studio.logoImageUrl}
        fallbackName={studio.studioName}
        size={markerSize}
        roundedSquare={false}
        fallbackIcon="building.2.fill"
        backgroundColor={color.surface}
      />
    </Box>
  );
};

export const StudioMapMarkerView = memo(StudioMapMarkerViewBase, (prev, next) => {
  return (
    prev.studio.studioId === next.studio.studioId &&
    prev.studio.studioName === next.studio.studioName &&
    prev.studio.logoImageUrl === next.studio.logoImageUrl &&
    prev.studio.mapMarkerColor === next.studio.mapMarkerColor &&
    prev.selected === next.selected
  );
});
