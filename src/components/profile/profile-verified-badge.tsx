import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo } from "react";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

type ProfileVerifiedBadgeProps = {
  size?: number;
};

export const ProfileVerifiedBadge = memo(function ProfileVerifiedBadge({
  size = BrandSpacing.controlSm,
}: ProfileVerifiedBadgeProps) {
  const { color: palette } = useTheme();
  const iconSize = Math.max(12, Math.round(size * 0.78));

  return (
    <Box
      accessibilityLabel="Verified"
      accessibilityRole="image"
      style={{
        width: size,
        height: size,
        borderRadius: BrandRadius.full,
        backgroundColor: palette.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialIcons name="verified" size={iconSize} color={palette.onPrimary} />
    </Box>
  );
});
