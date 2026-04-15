import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { ProfileVerifiedBadge } from "@/components/profile/profile-verified-badge";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { FontFamily, IconSize, Opacity } from "@/lib/design-system";
import { Box, Text } from "@/primitives";
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
  visualVariant?: "default" | "studioFeature";
  memberSince?: string | undefined;
  isVerified?: boolean;
};

const STUDIO_HERO_HEIGHT = 236;

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
  visualVariant = "default",
  memberSince,
  isVerified = false,
}: ProfileHeaderSheetProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useUnistyles();
  const resolvedPrimaryActionLabel = primaryActionLabel ?? t("profile.actions.edit");
  const isHebrew = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he");
  const profileNameFont = isHebrew ? "Kanit_800ExtraBold" : FontFamily.displayBold;
  const eyebrowFont = isHebrew ? "Kanit_600SemiBold" : FontFamily.label;
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

  if (visualVariant === "studioFeature") {
    return (
      <StudioFeatureHero
        profileName={profileName}
        roleLabel={roleLabel}
        profileImageUrl={profileImageUrl}
        onRequestEdit={onRequestEdit}
        resolvedPrimaryActionLabel={resolvedPrimaryActionLabel}
        resolvedStatusLabel={resolvedStatusLabel}
        statusTone={statusTone}
        sportsLabel={sportsLabel}
        summaryLabel={summaryLabel}
        sports={sports}
        isVerified={isVerified}
      />
    );
  }

  return (
    <Box pointerEvents="box-none" style={s.mobileShell}>
      <Box style={s.mobileTopRail}>
        <Box style={s.mobileEyebrow}>
          <Text style={[s.mobileEyebrowText, { fontFamily: eyebrowFont }]}>{roleLabel}</Text>
        </Box>
      </Box>

      <Box style={s.mobileIdentityRow}>
        <Box style={s.mobileAvatarWrap}>
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={profileName}
            size={52}
            roundedSquare={false}
          />
        </Box>

        <Box style={s.mobileIdentityTextWrap}>
          <Box style={s.mobileNameRow}>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.heroSmall,
                fontFamily: profileNameFont,
                letterSpacing: -0.3,
                lineHeight: 40,
                includeFontPadding: false,
                flex: 1,
                fontWeight: "700",
              }}
              color="text"
            >
              {profileName}
            </Text>
            {isVerified ? (
              <ProfileVerifiedBadge size={BrandSpacing.component + BrandSpacing.xxs} />
            ) : null}
            <IconButton
              accessibilityLabel={resolvedPrimaryActionLabel}
              onPress={onRequestEdit}
              size={32}
              tone="secondary"
              icon={<IconSymbol name="pencil" size={IconSize.sm} color={theme.color.primary} />}
            />
          </Box>
          <Box style={s.mobileMetaRow}>
            <Text
              style={{
                ...BrandType.caption,
                includeFontPadding: false,
              }}
              color="textMuted"
            >
              {memberSince ?? summaryLabel ?? resolvedStatusLabel}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

// ─── Studio feature hero (extracted for readability) ────────────────────────

function StudioFeatureHero({
  profileName,
  roleLabel,
  profileImageUrl,
  onRequestEdit,
  resolvedPrimaryActionLabel,
  resolvedStatusLabel,
  statusTone,
  sportsLabel,
  summaryLabel,
  sports,
  isVerified,
}: {
  profileName: string;
  roleLabel: string;
  profileImageUrl: string | null | undefined;
  onRequestEdit: () => void;
  resolvedPrimaryActionLabel: string;
  resolvedStatusLabel: string;
  statusTone: "success" | "warning" | "neutral";
  sportsLabel: string;
  summaryLabel: string;
  sports: string[];
  isVerified: boolean;
}) {
  const { theme } = useUnistyles();
  const { safeTop } = useAppInsets();
  const featureTopRailStyle = useMemo(
    () => [s.featureTopRail, { paddingTop: safeTop + BrandSpacing.lg }],
    [safeTop],
  );
  return (
    <View style={s.featureShell}>
      <View style={[s.featureHero, s.featureHeroShadow]}>
        {profileImageUrl ? (
          <Image
            source={{ uri: profileImageUrl }}
            contentFit="cover"
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        <View style={featureTopRailStyle}>
          <View style={s.featureRolePill}>
            <Text numberOfLines={1} style={[BrandType.micro, s.rolePillText]}>
              {roleLabel}
            </Text>
          </View>

          <IconButton
            accessibilityLabel={resolvedPrimaryActionLabel}
            onPress={onRequestEdit}
            tone="secondary"
            size={BrandSpacing.controlLg}
            icon={<IconSymbol name="pencil" size={IconSize.md + 1} color={theme.color.primary} />}
          />
        </View>

        <View style={s.featureBottomRail}>
          <View style={s.featureTitleRow}>
            <View style={s.featureTitleSkewWrap}>
              <Text numberOfLines={2} style={[s.featureTitle]}>
                {profileName}
              </Text>
            </View>
            {isVerified ? (
              <ProfileVerifiedBadge size={BrandSpacing.component + BrandSpacing.xs} />
            ) : null}
          </View>

          <View style={s.featureMetaRow}>
            {resolvedStatusLabel ? (
              <View style={s.featureStatusRow}>
                <View
                  style={[
                    s.featureStatusDot,
                    statusTone === "success" && s.statusDotSuccess,
                    statusTone === "warning" && s.statusDotWarning,
                    statusTone === "neutral" && s.statusDotNeutral,
                  ]}
                />
                <Text numberOfLines={1} style={[BrandType.bodyMedium, s.featureMetaText]}>
                  {resolvedStatusLabel}
                </Text>
              </View>
            ) : null}

            {sports.length > 0 ? (
              <Text numberOfLines={1} style={[BrandType.bodyMedium, s.featureMetaTextMuted]}>
                {sportsLabel}
              </Text>
            ) : null}
          </View>

          {summaryLabel ? (
            <Text numberOfLines={2} style={[BrandType.caption, s.featureSummary]}>
              {summaryLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Styles (theme-reactive via Unistyles) ──────────────────────────────────

const s = StyleSheet.create((theme) => ({
  // Studio feature variant
  featureShell: { width: "100%" },
  featureHero: {
    minHeight: STUDIO_HERO_HEIGHT,
    overflow: "hidden",
    borderCurve: "continuous",
    justifyContent: "space-between",
    backgroundColor: theme.color.surfaceElevated,
    borderBottomLeftRadius: BrandRadius.soft + BrandSpacing.xs,
    borderBottomRightRadius: BrandRadius.soft + BrandSpacing.xs,
  },
  featureHeroShadow: {
    ...theme.shadow.hero,
  },
  featureTopRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.lg,
    gap: BrandSpacing.md,
  },
  featureRolePill: {
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
    maxWidth: "78%",
    backgroundColor: theme.color.primary,
  },
  rolePillText: {
    color: theme.color.onPrimary,
  },
  featureBottomRail: {
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.xxl,
    paddingBottom: BrandSpacing.xl,
    gap: BrandSpacing.xs,
  },
  featureTitleSkewWrap: {
    alignSelf: "flex-start",
    transform: [{ skewX: "-10deg" }],
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    maxWidth: "92%",
  },
  featureTitle: {
    ...BrandType.heroSmall,
    fontFamily: FontFamily.display,
    includeFontPadding: false,
    color: theme.color.text,
  },
  featureMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: BrandSpacing.md,
    minHeight: BrandSpacing.controlSm,
  },
  featureStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.statusDot,
  },
  featureStatusDot: {
    width: BrandSpacing.statusDotBadge,
    height: BrandSpacing.statusDotBadge,
    borderRadius: BrandRadius.full,
  },
  statusDotSuccess: { backgroundColor: theme.color.success },
  statusDotWarning: { backgroundColor: theme.color.warning },
  statusDotNeutral: { backgroundColor: theme.color.primary },
  featureMetaText: {
    includeFontPadding: false,
    color: theme.color.text,
  },
  featureMetaTextMuted: {
    includeFontPadding: false,
    color: theme.color.textMuted,
  },
  featureSummary: {
    maxWidth: "88%",
    opacity: Opacity.subtle,
    color: theme.color.textMuted,
  },

  // Default mobile variant
  mobileShell: {
    paddingHorizontal: BrandSpacing.inset,
    paddingTop: BrandSpacing.sm,
    paddingBottom: BrandSpacing.lg,
    gap: BrandSpacing.md,
  },
  mobileTopRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    marginBottom: BrandSpacing.xs,
  },
  mobileEyebrow: {
    borderRadius: BrandRadius.buttonSubtle,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xxs,
    maxWidth: "86%",
    backgroundColor: theme.color.primary,
    ...theme.shadow.subtle,
  },
  mobileEyebrowText: {
    ...BrandType.micro,
    color: theme.color.onPrimary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  mobileIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  mobileAvatarWrap: {
    position: "relative",
    width: 56,
    height: 56,
    borderRadius: BrandRadius.full,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surfaceElevated,
    ...theme.shadow.subtle,
  },
  mobileIdentityTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: BrandSpacing.xxs,
  },
  mobileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  mobileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
}));
