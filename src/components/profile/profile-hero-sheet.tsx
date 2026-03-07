import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";

const PROFILE_HERO_EXPANDED_CONTENT_HEIGHT = 244;
const PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT = 94;
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
};

type ProfileHeroHighlight = {
  label: string;
  value: string;
  caption?: string;
  accent?: string;
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
      ? `${String(activeSocialCount)} links ready for your public profile`
      : t("profile.hero.focused", {
          defaultValue: "Keep your public profile focused and easy to scan.",
        }))
  );
}

function HeroActionButton({
  label,
  onPress,
  palette,
  kind = "primary",
}: {
  label: string;
  onPress: () => void;
  palette: BrandPalette;
  kind?: "primary" | "secondary" | "light";
}) {
  const backgroundColor =
    kind === "light"
      ? (palette.surface as string)
      : kind === "secondary"
        ? "rgba(255,255,255,0.16)"
        : (palette.text as string);
  const textColor =
    kind === "secondary" ? (palette.surface as string) : kind === "light" ? "#0A0A0A" : "#FFFFFF";

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          backgroundColor,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text
        style={{
          ...BrandType.bodyStrong,
          color: textColor,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </KitPressable>
  );
}

export function ProfileHeroSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  scrollY,
  onRequestEdit,
  primaryActionLabel = "Edit profile",
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
    height: interpolate(scrollY.value, [0, 80], [112, 0], Extrapolation.CLAMP),
    marginTop: interpolate(scrollY.value, [0, 80], [16, 0], Extrapolation.CLAMP),
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
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          overflow: "hidden",
          backgroundColor: palette.surfaceAlt as string,
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
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

          <Animated.View style={[{ flex: 1, gap: 4 }, identityBlockStyle]}>
            <Text
              style={{
                fontFamily: "Rubik_700Bold",
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: palette.textMuted as string,
                includeFontPadding: false,
              }}
            >
              {roleLabel}
            </Text>
            <Animated.Text
              numberOfLines={1}
              style={[
                {
                  fontFamily: "BarlowCondensed_700Bold",
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
                fontFamily: "Rubik_500Medium",
                fontSize: 13,
                color: palette.primary as string,
                includeFontPadding: false,
              }}
            >
              {sportsLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Rubik_400Regular",
                fontSize: 13,
                color: palette.textMuted as string,
              }}
            >
              {summaryLabel}
            </Text>
          </Animated.View>
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
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
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
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  {sportsLabel}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <KitButton label={primaryActionLabel} onPress={onRequestEdit} size="sm" />
              </View>
              {secondaryAction ? (
                <View style={{ flex: 1 }}>
                  <KitButton
                    label={secondaryAction.label}
                    onPress={secondaryAction.onPress}
                    variant="secondary"
                    size="sm"
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
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
  highlights,
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
  highlights: ProfileHeroHighlight[];
}) {
  return (
    <View
      style={{
        borderRadius: 34,
        borderCurve: "continuous",
        backgroundColor: palette.primary as string,
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
              color: "rgba(255,255,255,0.76)",
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            {roleLabel}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: "BarlowCondensed_800ExtraBold",
              fontSize: 40,
              lineHeight: 38,
              letterSpacing: -1,
              color: palette.onPrimary as string,
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
            backgroundColor: "rgba(255,255,255,0.16)",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              ...BrandType.micro,
              color: palette.onPrimary as string,
              letterSpacing: 0.9,
              textTransform: "uppercase",
            }}
          >
            {statusLabel}
          </Text>
        </View>
        <Text
          style={{
            ...BrandType.body,
            color: palette.onPrimary as string,
            opacity: 0.9,
          }}
        >
          {summary}
        </Text>
        {metaLabel ? (
          <Text
            style={{
              ...BrandType.caption,
              color: palette.onPrimary as string,
              opacity: 0.72,
            }}
          >
            {metaLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <HeroActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            palette={palette}
            kind="light"
          />
        </View>
        {secondaryAction ? (
          <View style={{ flex: 1 }}>
            <HeroActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              palette={palette}
              kind="secondary"
            />
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {highlights.map((highlight) => (
          <View
            key={highlight.label}
            style={{
              width: "47%",
              minHeight: 90,
              borderRadius: 24,
              borderCurve: "continuous",
              backgroundColor: "rgba(255,255,255,0.16)",
              paddingHorizontal: 14,
              paddingVertical: 14,
              gap: 4,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: 0.9,
                textTransform: "uppercase",
              }}
            >
              {highlight.label}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.title,
                color: highlight.accent ?? (palette.onPrimary as string),
                lineHeight: 22,
              }}
            >
              {highlight.value}
            </Text>
            {highlight.caption ? (
              <Text
                numberOfLines={2}
                style={{
                  ...BrandType.caption,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                {highlight.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
