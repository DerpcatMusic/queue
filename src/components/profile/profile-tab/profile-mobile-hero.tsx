import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import {
  getActiveSocialCount,
  getProfileSummary,
  getSportsLabel,
  type ProfileHeroStatus,
} from "./profile-hero-utils";

type ProfileHeaderSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  onRequestEdit: () => void;
  primaryActionLabel?: string;
  status?: ProfileHeroStatus;
  statusLabel?: string | undefined;
  bio?: string | null | undefined;
  socialLinks?: ProfileSocialLinks | undefined;
  sports: string[];
};

export const ProfileHeaderSheet = memo(function ProfileHeaderSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  onRequestEdit,
  primaryActionLabel,
  status,
  statusLabel,
  bio,
  socialLinks,
  sports,
}: ProfileHeaderSheetProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const resolvedPrimaryActionLabel = primaryActionLabel ?? t("profile.actions.edit");
  const activeSocialCount = getActiveSocialCount(socialLinks);
  const sportsLabel = getSportsLabel(sports, t);
  const summaryLabel = getProfileSummary(bio, activeSocialCount, t);
  const resolvedStatusLabel =
    statusLabel ??
    (status === "ready"
      ? t("profile.hero.statusReady")
      : status === "pending"
        ? t("profile.hero.statusPending")
        : status === "unverified"
          ? t("profile.hero.statusUnverified")
          : "");
  const statusTone = status === "ready" ? "success" : status === "pending" ? "warning" : "neutral";

  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingHorizontal: BrandSpacing.xl,
        paddingTop: BrandSpacing.xs,
        paddingBottom: BrandSpacing.sm,
        gap: BrandSpacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: BrandSpacing.component,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.component,
            flex: 1,
            minWidth: 0,
          }}
        >
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={profileName}
            size={72}
            roundedSquare
          />

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 12,
                fontWeight: "500",
                letterSpacing: 0.2,
                lineHeight: 16,
                color: palette.onPrimary,
                includeFontPadding: false,
              }}
            >
              {roleLabel}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: "Lexend_600SemiBold",
                fontSize: 26,
                fontWeight: "600",
                lineHeight: 28,
                letterSpacing: -0.3,
                color: palette.onPrimary,
                includeFontPadding: false,
              }}
            >
              {profileName}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.sm,
                minHeight: 18,
              }}
            >
              {resolvedStatusLabel ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.statusDot,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor:
                        statusTone === "success"
                          ? palette.success
                          : statusTone === "warning"
                            ? palette.warning
                            : palette.onPrimary,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: "Manrope_500Medium",
                      fontSize: 13,
                      fontWeight: "500",
                      lineHeight: 22,
                      color: palette.onPrimary,
                      includeFontPadding: false,
                    }}
                  >
                    {resolvedStatusLabel}
                  </Text>
                </View>
              ) : null}
              {sports.length > 0 ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Manrope_500Medium",
                    fontSize: 13,
                    fontWeight: "500",
                    lineHeight: 22,
                    color: palette.onPrimary,
                    includeFontPadding: false,
                  }}
                >
                  {sportsLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <IconButton
          accessibilityLabel={resolvedPrimaryActionLabel}
          onPress={onRequestEdit}
          tone="primarySubtle"
          size={48}
          icon={<IconSymbol name="pencil" size={21} color={palette.primary} />}
        />
      </View>

      {summaryLabel ? (
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.onPrimary,
          }}
        >
          {summaryLabel}
        </Text>
      ) : null}
    </View>
  );
});
