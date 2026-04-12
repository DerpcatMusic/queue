import { memo } from "react";
import { View } from "react-native";

import type { StudioMapMarker } from "@/components/maps/queue-map.types";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

export const STUDIO_MAP_MARKER_SIZE = BrandSpacing.avatarSm;
export const STUDIO_MAP_MARKER_OUTER_SIZE = STUDIO_MAP_MARKER_SIZE + BrandSpacing.md;

type StudioMapMarkerViewProps = {
  studio: StudioMapMarker;
  selected?: boolean;
  onAvatarLoad?: () => void;
  scale?: number;
};

const StudioMapMarkerViewBase = ({
  studio,
  selected = false,
  onAvatarLoad,
  scale = 1,
}: StudioMapMarkerViewProps) => {
  const { color } = useTheme();
  const markerSize = Math.max(1, Math.round(STUDIO_MAP_MARKER_SIZE * scale));
  const outerSize = Math.max(1, Math.round(STUDIO_MAP_MARKER_OUTER_SIZE * scale));
  const borderColor = studio.mapMarkerColor ?? color.primary;

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: borderColor,
        padding: Math.round((selected ? BrandSpacing.sm : BrandSpacing.xs) * scale),
        overflow: "hidden",
        transform: [{ scale: selected ? 1.04 : 1 }],
        shadowColor: borderColor,
        shadowOpacity: selected ? 0.28 : 0.18,
        shadowRadius: selected ? 10 : 7,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <ProfileAvatar
        imageUrl={studio.logoImageUrl}
        fallbackName={studio.studioName}
        size={Math.max(1, markerSize - Math.round(BrandSpacing.xs * 2 * scale))}
        roundedSquare={false}
        fallbackIcon="building.2.fill"
        backgroundColor={color.surface}
        {...(onAvatarLoad ? { onImageLoad: onAvatarLoad } : {})}
      />
    </View>
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
