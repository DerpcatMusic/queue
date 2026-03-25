import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, FontFamily, IconSize, Opacity } from "@/lib/design-system";
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
};

const STUDIO_HERO_HEIGHT = 236;

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

  if (visualVariant === "studioFeature") {
    const bottomScrimColor = typeof palette.primary === "string" ? palette.primary : "#000000";

    return (
      <View style={styles.featureShell}>
        <View
          style={[
            styles.featureHero,
            {
              backgroundColor: palette.primary,
              borderBottomLeftRadius: BrandRadius.card + BrandSpacing.xs,
              borderBottomRightRadius: BrandRadius.card + BrandSpacing.xs,
            },
          ]}
        >
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              resizeMode="cover"
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
              { backgroundColor: hexToRgba(bottomScrimColor, profileImageUrl ? 0.08 : 0) },
            ]}
          />

          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <SvgLinearGradient id="studioProfileHeroScrim" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={hexToRgba(bottomScrimColor, 0.02)} />
                <Stop offset="54%" stopColor={hexToRgba(bottomScrimColor, 0.08)} />
                <Stop offset="78%" stopColor={hexToRgba(bottomScrimColor, 0.78)} />
                <Stop offset="100%" stopColor={bottomScrimColor} />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#studioProfileHeroScrim)" />
          </Svg>

          <View style={styles.featureTopRail}>
            <View
              style={[
                styles.featureRolePill,
                {
                  backgroundColor: hexToRgba(bottomScrimColor, 0.22),
                  borderColor: hexToRgba(palette.onPrimary as string, 0.18),
                },
              ]}
            >
              <Text numberOfLines={1} style={[BrandType.micro, { color: palette.onPrimary }]}>
                {roleLabel}
              </Text>
            </View>

            <IconButton
              accessibilityLabel={resolvedPrimaryActionLabel}
              onPress={onRequestEdit}
              tone="primarySubtle"
              size={BrandSpacing.controlLg}
              icon={<IconSymbol name="pencil" size={IconSize.md + 1} color={palette.primary} />}
            />
          </View>

          <View style={styles.featureBottomRail}>
            <Text numberOfLines={2} style={[styles.featureTitle, { color: palette.onPrimary }]}>
              {profileName}
            </Text>

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
                              : palette.onPrimary,
                      },
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      BrandType.bodyMedium,
                      styles.featureMetaText,
                      { color: palette.onPrimary },
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
                    { color: hexToRgba(palette.onPrimary as string, 0.9) },
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
                  { color: hexToRgba(palette.onPrimary as string, 0.84) },
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
                ...BrandType.micro,
                color: palette.onPrimary,
                includeFontPadding: false,
              }}
            >
              {roleLabel}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.heading,
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
                      ...BrandType.caption,
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
                    ...BrandType.caption,
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
            ...BrandType.caption,
            color: palette.onPrimary,
          }}
        >
          {summaryLabel}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  featureShell: {
    paddingHorizontal: BrandSpacing.xl,
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.sm,
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
    borderWidth: BorderWidth.thin,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
    maxWidth: "78%",
  },
  featureBottomRail: {
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.xl,
    paddingBottom: BrandSpacing.xl,
    gap: BrandSpacing.xs,
  },
  featureTitle: {
    ...BrandType.heroSmall,
    fontFamily: FontFamily.display,
    includeFontPadding: false,
    transform: [{ skewX: "-8deg" }],
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
});
