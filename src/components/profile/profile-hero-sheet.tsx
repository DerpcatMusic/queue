import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitStatusBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";

const PROFILE_HEADER_CONTENT_HEIGHT = 128;

type ProfileHeroAction = {
  label: string;
  onPress: () => void;
  icon?:
    | "sparkles"
    | "slider.horizontal.3"
    | "checkmark.circle.fill"
    | "calendar.badge.clock"
    | "mappin.and.ellipse";
};

type ProfileHeroStatus = "ready" | "pending" | "unverified";

export function getProfileHeaderExpandedHeight(safeTop: number) {
  return safeTop + PROFILE_HEADER_CONTENT_HEIGHT;
}

function getSportsLabel(sports: string[], t: ReturnType<typeof useTranslation>["t"]) {
  return sports.length === 0
    ? t("profile.settings.sports.none")
    : sports.length <= 2
      ? sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ")
      : `${isSportType(sports[0] ?? "") ? toSportLabel(sports[0] as (typeof SPORT_TYPES)[number]) : sports[0]} +${String(
          sports.length - 1,
        )}`;
}

function getProfileSummary(
  bio: string | null | undefined,
  activeSocialCount: number,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const trimmed = bio?.trim();
  if (trimmed) {
    return trimmed;
  }
  return activeSocialCount > 0 ? t("profile.hero.linksReady", { count: activeSocialCount }) : "";
}

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
  const activeSocialCount = Object.values(socialLinks ?? {}).filter((value) =>
    Boolean(value?.trim()),
  ).length;
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
        paddingTop: BrandSpacing.sm,
        paddingBottom: BrandSpacing.lg,
        gap: BrandSpacing.md,
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

          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
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
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.heading,
                fontSize: 26,
                lineHeight: 30,
                color: palette.onPrimary as string,
                letterSpacing: -0.3,
                includeFontPadding: false,
              }}
            >
              {profileName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.bodyMedium,
                fontSize: 13,
                color: palette.onPrimary as string,
                opacity: 0.76,
                includeFontPadding: false,
              }}
            >
              {sportsLabel}
            </Text>
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

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {resolvedStatusLabel ? (
          <KitStatusBadge
            label={resolvedStatusLabel}
            tone={
              statusTone === "success"
                ? "success"
                : statusTone === "warning"
                  ? "warning"
                  : "neutral"
            }
            showDot
          />
        ) : null}
        {sports.length > 0 ? (
          <KitStatusBadge label={sportsLabel} tone="neutral" showDot={false} />
        ) : null}
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

export const ProfileDesktopHeroPanel = memo(function ProfileDesktopHeroPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  summary,
  statusLabel,
  statusTone = "neutral",
  metaLabel,
  primaryAction,
  secondaryAction,
}: {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  summary: string;
  statusLabel: string;
  statusTone?: "neutral" | "success" | "warning";
  metaLabel?: string | undefined;
  primaryAction: ProfileHeroAction;
  secondaryAction?: ProfileHeroAction | undefined;
}) {
  return (
    <View
      style={{
        borderRadius: 34,
        borderCurve: "continuous",
        backgroundColor: palette.surface as string,
        paddingHorizontal: 22,
        paddingVertical: 22,
        gap: 18,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          palette={palette}
          size={84}
          roundedSquare
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro as string,
              letterSpacing: 0.2,
            }}
          >
            {roleLabel}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              ...BrandType.display,
              fontSize: 34,
              lineHeight: 38,
              letterSpacing: -0.6,
              color: palette.text as string,
            }}
          >
            {profileName}
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KitStatusBadge
          label={statusLabel}
          tone={
            statusTone === "success" ? "success" : statusTone === "warning" ? "warning" : "neutral"
          }
          showDot
        />
        {summary ? (
          <Text
            style={{
              ...BrandType.body,
              color: palette.textMuted as string,
            }}
          >
            {summary}
          </Text>
        ) : null}
        {metaLabel ? (
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMicro as string,
            }}
          >
            {metaLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            palette={palette}
            fullWidth
          />
        </View>
        {secondaryAction ? (
          <View style={{ flex: 1 }}>
            <ActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              palette={palette}
              tone="secondary"
              fullWidth
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});
