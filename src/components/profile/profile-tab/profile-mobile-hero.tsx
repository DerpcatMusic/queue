import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
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
  palette: BrandPalette;
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
  palette,
  onRequestEdit,
  primaryActionLabel,
  status,
  statusLabel,
  bio,
  socialLinks,
  sports,
}: ProfileHeaderSheetProps) {
  const { t } = useTranslation();
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
        paddingTop: 2,
        paddingBottom: BrandSpacing.sm,
        gap: BrandSpacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            flex: 1,
            minWidth: 0,
          }}
        >
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={profileName}
            palette={palette}
            size={72}
            roundedSquare
          />

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text
              style={{
                ...BrandType.micro,
                color: palette.onPrimary as string,
                letterSpacing: 0.2,
                includeFontPadding: false,
              }}
            >
              {roleLabel}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.heading,
                fontSize: 26,
                lineHeight: 28,
                color: palette.onPrimary as string,
                letterSpacing: -0.3,
                includeFontPadding: false,
              }}
            >
              {profileName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 18 }}>
              {resolvedStatusLabel ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor:
                        statusTone === "success"
                          ? (palette.success as string)
                          : statusTone === "warning"
                            ? (palette.warning as string)
                            : (palette.onPrimary as string),
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyMedium,
                      fontSize: 13,
                      color: palette.onPrimary as string,
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
                    ...BrandType.bodyMedium,
                    fontSize: 13,
                    color: palette.onPrimary as string,
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
          icon={<IconSymbol name="pencil" size={21} color={palette.primary as string} />}
        />
      </View>

      {summaryLabel ? (
        <Text
          numberOfLines={2}
          style={{
            ...BrandType.caption,
            color: palette.onPrimary as string,
          }}
        >
          {summaryLabel}
        </Text>
      ) : null}
    </View>
  );
});
