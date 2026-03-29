import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo } from "react";
import { View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type ProfileVerifiedBadgeProps = {
  size?: number;
};

export const ProfileVerifiedBadge = memo(function ProfileVerifiedBadge({
  size = BrandSpacing.controlSm,
}: ProfileVerifiedBadgeProps) {
  const theme = useTheme();
  const iconSize = Math.max(12, Math.round(size * 0.78));

  return (
    <View
      accessibilityLabel="Verified"
      accessibilityRole="image"
      style={{
        width: size,
        height: size,
        borderRadius: BrandRadius.full,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialIcons
        name="verified"
        size={iconSize}
        color={theme.color.tertiary}
      />
    </View>
  );
});
