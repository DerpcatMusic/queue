import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { TopSheet } from "@/components/layout/top-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

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
  const { t } = useTranslation();

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "approved":
        return {
          color: palette.success,
          label: t("profile.identityVerification.badgeLabels.verified"),
        };
      case "in_review":
      case "pending":
      case "in_progress":
        return {
          color: palette.warning,
          label: t("profile.identityVerification.badgeLabels.pending"),
        };
      case "declined":
      case "expired":
      case "abandoned":
        return {
          color: palette.danger,
          label: t("profile.identityVerification.badgeLabels.actionNeeded"),
        };
      default:
        return {
          color: palette.textMuted,
          label: t("profile.identityVerification.badgeLabels.unverified"),
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <TopSheet
      steps={[0.2, 0.5, 0.95]}
      draggable={true}
      expandable={true}
      topInsetColor={palette.primary}
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
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: BrandRadius.button - 10,
                borderCurve: "continuous",
                backgroundColor:
                  verificationStatus === "approved"
                    ? (palette.successSubtle as string)
                    : verificationStatus === "declined" ||
                        verificationStatus === "expired" ||
                        verificationStatus === "abandoned"
                      ? (palette.dangerSubtle as string)
                      : (palette.primarySubtle as string),
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: statusConfig.color as string,
                  letterSpacing: 0.4,
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
