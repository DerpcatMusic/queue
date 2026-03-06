import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import {
  type ProfileSocialLinks,
  ProfileSocialLinksRow,
} from "@/components/profile/profile-social-links";
import { KitButton } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";

const PROFILE_HERO_EXPANDED_CONTENT_HEIGHT = 232;
const PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT = 108;
const PROFILE_HERO_CONTENT_GAP = BrandSpacing.md;
const PROFILE_HERO_COLLAPSE_END = 116;

export function getProfileHeroExpandedHeight(safeTop: number) {
  return safeTop + PROFILE_HERO_EXPANDED_CONTENT_HEIGHT;
}

export function getProfileHeroScrollTopPadding(safeTop: number) {
  return getProfileHeroExpandedHeight(safeTop) + PROFILE_HERO_CONTENT_GAP;
}

type ProfileHeroSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  scrollY: SharedValue<number>;
  onRequestEdit: () => void;
  bio?: string | null | undefined;
  socialLinks?: ProfileSocialLinks | undefined;
  sports: string[];
};

export function ProfileHeroSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  scrollY,
  onRequestEdit,
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

  const sportsLabel =
    sports.length === 0
      ? t("profile.settings.sports.none")
      : sports.length <= 2
        ? sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ")
        : `${isSportType(sports[0] ?? "") ? toSportLabel(sports[0] as (typeof SPORT_TYPES)[number]) : sports[0]} +${String(
            sports.length - 1,
          )}`;

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
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
          borderBottomWidth: 1,
          borderBottomColor: palette.border as string,
          borderCurve: "continuous",
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

          <Animated.View style={[{ flex: 1, gap: 6 }, identityBlockStyle]}>
            <Text
              style={{
                fontFamily: "Rubik_500Medium",
                fontSize: 13,
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
                  fontFamily: "Rubik_400Regular",
                  color: palette.text as string,
                  letterSpacing: -0.3,
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
          </Animated.View>

          <KitButton label="Edit" onPress={onRequestEdit} variant="ghost" size="sm" />
        </View>

        <View style={{ marginTop: 12, gap: 12 }}>
          {bio?.trim() ? (
            <Text
              numberOfLines={2}
              style={{
                fontFamily: "Rubik_400Regular",
                fontSize: 14,
                lineHeight: 20,
                color: palette.textMuted as string,
              }}
            >
              {bio}
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Rubik_400Regular",
                fontSize: 14,
                color: palette.textMuted as string,
              }}
            >
              Keep your public profile focused and easy to scan.
            </Text>
          )}

          {activeSocialCount > 0 ? (
            <ProfileSocialLinksRow socialLinks={socialLinks} palette={palette} />
          ) : (
            <Text
              style={{
                fontFamily: "Rubik_500Medium",
                fontSize: 13,
                color: palette.textMicro as string,
              }}
            >
              Add only the links people already expect to find.
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
