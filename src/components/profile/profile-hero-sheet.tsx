import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { TopSheetSurface } from "@/components/layout/top-sheet-surface";
import { ProfileIconButton } from "@/components/profile/profile-settings-sections";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { ActionButton } from "@/components/ui/action-button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";

const PROFILE_HERO_EXPANDED_CONTENT_HEIGHT = 204;
const PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT = 98;
const PROFILE_HERO_CONTENT_GAP = BrandSpacing.md;
const PROFILE_HERO_COLLAPSE_END = 116;

export function getProfileHeroExpandedHeight(safeTop: number) {
  return safeTop + PROFILE_HERO_EXPANDED_CONTENT_HEIGHT;
}

export function getProfileHeroScrollTopPadding(safeTop: number) {
  return getProfileHeroExpandedHeight(safeTop) + PROFILE_HERO_CONTENT_GAP;
}

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

type ProfileHeroSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  scrollY: SharedValue<number>;
  onRequestEdit: () => void;
  primaryActionLabel?: string;
  secondaryAction?: ProfileHeroAction | undefined;
  statusLabel?: string | undefined;
  bio?: string | null | undefined;
  socialLinks?: ProfileSocialLinks | undefined;
  sports: string[];
};

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
  return (
    bio?.trim() ||
    (activeSocialCount > 0
      ? t("profile.hero.linksReady", { count: activeSocialCount })
      : t("profile.hero.focused"))
  );
}

export function ProfileHeroSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  scrollY,
  onRequestEdit,
  primaryActionLabel,
  secondaryAction,
  statusLabel,
  bio,
  socialLinks,
  sports,
}: ProfileHeroSheetProps) {
  const { t } = useTranslation();
  const { safeTop } = useAppInsets();
  const contractedHeight = safeTop + PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT;
  const activeSocialCount = Object.values(socialLinks ?? {}).filter((value) =>
    Boolean(value?.trim()),
  ).length;
  const resolvedPrimaryActionLabel = primaryActionLabel ?? t("profile.actions.edit");
  const sportsLabel = getSportsLabel(sports, t);
  const summaryLabel = getProfileSummary(bio, activeSocialCount, t);

  const profileAvatarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, PROFILE_HERO_COLLAPSE_END],
          [1.04, 0.76],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const identityBlockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, PROFILE_HERO_COLLAPSE_END],
      [1, 0.82],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, PROFILE_HERO_COLLAPSE_END],
          [0, -6],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      scrollY.value,
      [0, PROFILE_HERO_COLLAPSE_END],
      [26, 19],
      Extrapolation.CLAMP,
    ),
    lineHeight: interpolate(
      scrollY.value,
      [0, PROFILE_HERO_COLLAPSE_END],
      [31, 24],
      Extrapolation.CLAMP,
    ),
  }));

  const expandedDetailsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, 80], [88, 0], Extrapolation.CLAMP),
    marginTop: interpolate(scrollY.value, [0, 80], [14, 0], Extrapolation.CLAMP),
  }));

  const animatedSheetStyle = useAnimatedStyle(() => {
    const pullStretch = interpolate(scrollY.value, [-120, 0], [84, 0], Extrapolation.CLAMP);
    const collapsedBase = interpolate(
      scrollY.value,
      [0, PROFILE_HERO_COLLAPSE_END],
      [safeTop + PROFILE_HERO_EXPANDED_CONTENT_HEIGHT, contractedHeight],
      Extrapolation.CLAMP,
    );

    return {
      height: collapsedBase + pullStretch,
    };
  });

  return (
    <TopSheetSurface
      pointerEvents="box-none"
      backgroundColor={palette.surfaceAlt}
      topInsetColor={palette.primary}
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          overflow: "hidden",
          backgroundColor: palette.surfaceAlt as string,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          borderBottomWidth: 1,
          borderCurve: "continuous",
          borderColor: palette.border as string,
        },
        animatedSheetStyle,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          paddingTop: safeTop + BrandSpacing.sm,
          paddingBottom: BrandSpacing.lg,
          paddingHorizontal: BrandSpacing.xl,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              flex: 1,
              minWidth: 0,
            }}
          >
            <View style={{ borderRadius: 24 }}>
              <Animated.View style={profileAvatarStyle}>
                <ProfileAvatar
                  imageUrl={profileImageUrl}
                  fallbackName={profileName}
                  palette={palette}
                  size={74}
                  roundedSquare
                />
              </Animated.View>
            </View>

            <Animated.View style={[{ flex: 1, gap: 4, minWidth: 0 }, identityBlockStyle]}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMicro as string,
                  letterSpacing: 0.2,
                  includeFontPadding: false,
                }}
              >
                {roleLabel}
              </Text>
              <Animated.Text
                numberOfLines={2}
                style={[
                  {
                    ...BrandType.heading,
                    color: palette.text as string,
                    letterSpacing: -0.2,
                    includeFontPadding: false,
                  },
                  nameStyle,
                ]}
              >
                {profileName}
              </Animated.Text>
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyMedium,
                  fontSize: 13,
                  color: palette.textMuted as string,
                  includeFontPadding: false,
                }}
              >
                {sportsLabel}
              </Text>
            </Animated.View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <ProfileIconButton
              icon="pencil"
              label={resolvedPrimaryActionLabel}
              onPress={onRequestEdit}
              palette={palette}
              tone="accent"
            />
            {secondaryAction ? (
              <ProfileIconButton
                icon={secondaryAction.icon ?? "sparkles"}
                label={secondaryAction.label}
                onPress={secondaryAction.onPress}
                palette={palette}
              />
            ) : null}
          </View>
        </View>

        <Animated.View style={[{ overflow: "hidden" }, expandedDetailsStyle]}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {statusLabel ? (
                <View
                  style={{
                    borderRadius: 999,
                    borderCurve: "continuous",
                    backgroundColor: palette.primarySubtle as string,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.primary as string,
                      letterSpacing: 0.2,
                    }}
                  >
                    {statusLabel}
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  borderRadius: 999,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 0.2,
                  }}
                >
                  {sportsLabel}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
              }}
            >
              {summaryLabel}
            </Text>
          </View>
        </Animated.View>
      </View>
    </TopSheetSurface>
  );
}

export function ProfileDesktopHeroPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  summary,
  statusLabel,
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
  metaLabel?: string | undefined;
  primaryAction: ProfileHeroAction;
  secondaryAction?: ProfileHeroAction | undefined;
}) {
  return (
    <View
      style={{
        borderRadius: 34,
        borderCurve: "continuous",
        backgroundColor: palette.surfaceAlt as string,
        borderWidth: 1,
        borderColor: palette.border as string,
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
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            borderCurve: "continuous",
            backgroundColor: palette.surface as string,
            borderWidth: 1,
            borderColor: palette.border as string,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary as string,
              letterSpacing: 0.2,
            }}
          >
            {statusLabel}
          </Text>
        </View>
        <Text
          style={{
            ...BrandType.body,
            color: palette.textMuted as string,
          }}
        >
          {summary}
        </Text>
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
            tone="secondary"
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
}
