import { Image } from "expo-image";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { StyleSheet } from "react-native-unistyles";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { ProfileVerifiedBadge } from "@/components/profile/profile-verified-badge";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
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
const BRIGHT_LIME = "#CCFF00";

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.startsWith("#") ? hex : "#000000";
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const { color: palette } = useTheme();
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
    const topMaskColor = BRIGHT_LIME;
    const bottomMaskColor = typeof palette.appBg === "string" ? palette.appBg : "#F6F4EE";

    return (
      <View style={styles.featureShell}>
        <View
          style={[
            styles.featureHero,
            {
              backgroundColor: palette.surfaceElevated,
              borderBottomLeftRadius: BrandRadius.soft + BrandSpacing.xs,
              borderBottomRightRadius: BrandRadius.soft + BrandSpacing.xs,
              shadowColor: "#000000",
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 3,
            },
          ]}
        >
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              contentFit="cover"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.featureFallback]}>
              <ProfileAvatar
                fallbackName={profileName}
                imageUrl={null}
                roundedSquare
                size={BrandSpacing.iconContainerLarge + BrandSpacing.xl}
              />
            </View>
          )}

          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: hexToRgba(bottomMaskColor, profileImageUrl ? 0.1 : 0),
              },
            ]}
          />

          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <SvgLinearGradient id="studioProfileHeroTopScrim" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={hexToRgba(topMaskColor, 0.3)} />
                <Stop offset="36%" stopColor={hexToRgba(topMaskColor, 0.1)} />
                <Stop offset="100%" stopColor={hexToRgba(topMaskColor, 0)} />
              </SvgLinearGradient>
              <SvgLinearGradient
                id="studioProfileHeroBottomScrim"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <Stop offset="0%" stopColor={hexToRgba(bottomMaskColor, 0)} />
                <Stop offset="56%" stopColor={hexToRgba(bottomMaskColor, 0.18)} />
                <Stop offset="78%" stopColor={hexToRgba(bottomMaskColor, 0.92)} />
                <Stop offset="100%" stopColor={bottomMaskColor} />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#studioProfileHeroTopScrim)" />
            <Rect width="100%" height="100%" fill="url(#studioProfileHeroBottomScrim)" />
          </Svg>

          <View style={styles.featureTopRail}>
            <View
              style={[
                styles.featureRolePill,
                {
                  backgroundColor: BRIGHT_LIME,
                },
              ]}
            >
              <Text numberOfLines={1} style={[BrandType.micro, { color: "#161E00" }]}>
                {roleLabel}
              </Text>
            </View>

            <IconButton
              accessibilityLabel={resolvedPrimaryActionLabel}
              onPress={onRequestEdit}
              tone="secondary"
              size={BrandSpacing.controlLg}
              icon={<IconSymbol name="pencil" size={IconSize.md + 1} color={BRIGHT_LIME} />}
            />
          </View>

          <View style={styles.featureBottomRail}>
            <View style={styles.featureTitleRow}>
              <View style={styles.featureTitleSkewWrap}>
                <Text numberOfLines={2} style={[styles.featureTitle, { color: palette.text }]}>
                  {profileName}
                </Text>
              </View>
              {isVerified ? (
                <ProfileVerifiedBadge size={BrandSpacing.component + BrandSpacing.xs} />
              ) : null}
            </View>

            <View style={styles.featureMetaRow}>
              {resolvedStatusLabel ? (
                <View style={styles.featureStatusRow}>
                  <View
                    style={[
                      styles.featureStatusDot,
                      {
                        backgroundColor:
                          statusTone === "success"
                            ? palette.success
                            : statusTone === "warning"
                              ? palette.warning
                              : BRIGHT_LIME,
                      },
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      BrandType.bodyMedium,
                      styles.featureMetaText,
                      { color: palette.text },
                    ]}
                  >
                    {resolvedStatusLabel}
                  </Text>
                </View>
              ) : null}

              {sports.length > 0 ? (
                <Text
                  numberOfLines={1}
                    style={[
                      BrandType.bodyMedium,
                      styles.featureMetaText,
                      { color: palette.textMuted },
                    ]}
                  >
                  {sportsLabel}
                </Text>
              ) : null}
            </View>

            {summaryLabel ? (
              <Text
                numberOfLines={2}
                style={[
                  BrandType.caption,
                  styles.featureSummary,
                  { color: palette.textMuted },
                ]}
              >
                {summaryLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <Box pointerEvents="box-none" style={styles.mobileShell}>
      <Box style={styles.mobileTopRail}>
        <Box
          style={[
            styles.mobileEyebrow,
            {
              backgroundColor: BRIGHT_LIME,
            },
          ]}
        >
          <Text
            style={[
              styles.mobileEyebrowText,
              { color: "#161E00", fontFamily: eyebrowFont },
            ]}
          >
            {roleLabel}
          </Text>
        </Box>
      </Box>

      <Box style={styles.mobileIdentityRow}>
        <Box
          style={[
            styles.mobileAvatarWrap,
            {
              backgroundColor: "#FFFFFF",
              shadowColor: "#000000",
              shadowOpacity: 0.05,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 0,
            },
          ]}
        >
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={profileName}
            size={52}
            roundedSquare={false}
          />
        </Box>

        <Box style={styles.mobileIdentityTextWrap}>
          <Box style={styles.mobileNameRow}>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.heroSmall,
                fontFamily: profileNameFont,
                letterSpacing: -0.3,
                lineHeight: 40,
                color: palette.text,
                includeFontPadding: false,
                flex: 1,
                fontWeight: "700",
              }}
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
              icon={<IconSymbol name="pencil" size={IconSize.sm} color={BRIGHT_LIME} />}
            />
          </Box>
          <Box style={styles.mobileMetaRow}>
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted,
                includeFontPadding: false,
              }}
            >
              {memberSince ?? summaryLabel ?? resolvedStatusLabel}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

const styles = StyleSheet.create({
  featureShell: {
    width: "100%",
  },
  featureHero: {
    minHeight: STUDIO_HERO_HEIGHT,
    overflow: "hidden",
    borderCurve: "continuous",
    justifyContent: "space-between",
  },
  featureFallback: {
    alignItems: "center",
    justifyContent: "center",
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
  featureMetaText: {
    includeFontPadding: false,
  },
  featureSummary: {
    maxWidth: "88%",
    opacity: Opacity.subtle,
  },
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
    shadowColor: "#000000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  mobileEyebrowText: {
    ...BrandType.micro,
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
});
