import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import {
  getActiveSocialCount,
  getProfileSummary,
  getSportsLabel,
  type ProfileHeroStatus,
} from "./profile-hero-utils";

const AVATAR_SIZE = BrandSpacing.iconContainerLarge; // 78px - consistent with home-header-sheet
const ICON_SIZE = BrandSpacing.iconContainer + BrandSpacing.sm; // ~46px
const ICON_SYMBOL_SIZE = BrandSpacing.md + BrandSpacing.xs; // ~16px

type ProfileHeaderSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  onRequestEdit: () => void;
  onOpenSwitcher?: () => void;
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
  onOpenSwitcher,
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
          gap: BrandSpacing.componentPadding,
        }}
      >
        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.componentPadding,
            flex: 1,
            minWidth: 0,
          }}
          accessibilityRole={onOpenSwitcher ? "button" : undefined}
          accessibilityLabel={onOpenSwitcher ? t("profile.switcher.openAction") : undefined}
          onPress={onOpenSwitcher}
        >
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={profileName}
            palette={palette}
            size={AVATAR_SIZE}
            roundedSquare
          />

          <View style={{ flex: 1, gap: BrandSpacing.xs, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.64,
                  letterSpacing: 0.2,
                  includeFontPadding: false,
                }}
              >
                {roleLabel}
              </Text>
              {onOpenSwitcher ? (
                <IconSymbol
                  name="chevron.down"
                  size={12}
                  color={palette.onPrimary as string}
                />
              ) : null}
            </View>
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.sm,
                minHeight: BrandSpacing.lg + BrandSpacing.xs / 2,
              }}
            >
              {resolvedStatusLabel ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
                  <View
                    style={{
                      width: BrandSpacing.statusDot,
                      height: BrandSpacing.statusDot,
                      borderRadius: BrandRadius.icon,
                      backgroundColor:
                        statusTone === "success"
                          ? (palette.success as string)
                          : statusTone === "warning"
                            ? (palette.warning as string)
                            : (palette.onPrimary as string),
                      opacity: statusTone === "neutral" ? 0.62 : 1,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyMedium,
                      fontSize: 13,
                      color: palette.onPrimary as string,
                      opacity: 0.74,
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
                    opacity: 0.74,
                    includeFontPadding: false,
                  }}
                >
                  {sportsLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        <IconButton
          accessibilityLabel={resolvedPrimaryActionLabel}
          onPress={onRequestEdit}
          tone="primarySubtle"
          size={ICON_SIZE}
          icon={
            <IconSymbol name="pencil" size={ICON_SYMBOL_SIZE} color={palette.primary as string} />
          }
        />
      </View>

      {summaryLabel ? (
        <Text
          numberOfLines={2}
          style={{
            ...BrandType.caption,
            color: palette.onPrimary as string,
            opacity: 0.76,
          }}
        >
          {summaryLabel}
        </Text>
      ) : null}
    </View>
  );
});
