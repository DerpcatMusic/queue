import { Pressable, Text, View } from "react-native";

import { TopSheet } from "@/components/layout/top-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

type ProfileHeaderSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  onPressEdit: () => void;
  verificationStatus?:
    | "approved"
    | "declined"
    | "in_review"
    | "pending"
    | "in_progress"
    | "abandoned"
    | "expired"
    | "not_started";
  onStepChange?: (index: number) => void;
};

/**
 * A responsive, native-feeling header for the Profile tabs on mobile.
 * Injected into a TopSheet with interactive expansion logic.
 */
export function ProfileHeaderSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  onPressEdit,
  verificationStatus = "not_started",
  onStepChange,
}: ProfileHeaderSheetProps) {
  // Map verification status to badge colors/labels
  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "approved":
        return { color: palette.success, label: "Verified" };
      case "in_review":
      case "pending":
      case "in_progress":
        return { color: palette.warning, label: "Pending" };
      case "declined":
      case "expired":
      case "abandoned":
        return { color: palette.danger, label: "Action Needed" };
      default:
        return { color: palette.textMuted, label: "Unverified" };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <TopSheet
      steps={[0.2, 0.5, 0.95]}
      draggable={true}
      expandable={true}
      {...(onStepChange ? { onStepChange } : {})}
      padding={{ vertical: BrandSpacing.md, horizontal: BrandSpacing.xl }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: BrandSpacing.lg,
        }}
      >
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          palette={palette}
          size={72}
          roundedSquare
        />

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.display,
                fontSize: 26,
                lineHeight: 30,
                color: palette.onPrimary as string,
                letterSpacing: -0.5,
              }}
            >
              {profileName}
            </Text>
            <Pressable
              onPress={onPressEdit}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <IconSymbol name="pencil.circle.fill" size={24} color={palette.onPrimary as string} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: (statusConfig.color as string) + "15",
                borderWidth: 1,
                borderColor: (statusConfig.color as string) + "30",
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  fontSize: 10,
                  color: statusConfig.color as string,
                  fontWeight: "700",
                }}
              >
                {statusConfig.label.toUpperCase()}
              </Text>
            </View>
            <Text
              style={{
                ...BrandType.caption,
                fontSize: 13,
                color: palette.onPrimary as string,
                opacity: 0.8,
              }}
            >
              {roleLabel}
            </Text>
          </View>
        </View>
      </View>
    </TopSheet>
  );
}
