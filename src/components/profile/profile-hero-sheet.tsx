import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, Text, type TextInputProps, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  PROFILE_SOCIAL_FIELDS,
  type ProfileSocialKey,
  type ProfileSocialLinks,
  ProfileSocialLinksRow,
} from "@/components/profile/profile-social-links";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { KitButton, KitPressable, KitTextField } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";

const PROFILE_HERO_EXPANDED_CONTENT_HEIGHT = 232;
const PROFILE_HERO_EDIT_CONTENT_HEIGHT = 690;
const PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT = 108;
const PROFILE_HERO_CONTENT_GAP = BrandSpacing.md;
const PROFILE_HERO_COLLAPSE_END = 116;

export function getProfileHeroExpandedHeight(safeTop: number) {
  return safeTop + PROFILE_HERO_EXPANDED_CONTENT_HEIGHT;
}

export function getProfileHeroScrollTopPadding(safeTop: number) {
  return getProfileHeroExpandedHeight(safeTop) + PROFILE_HERO_CONTENT_GAP;
}

type EditableExtraField = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
};

type ProfileHeroSheetProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  scrollY: SharedValue<number>;
  isEditing: boolean;
  onRequestEdit: () => void;
  onDismissEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  statusLabel?: string | null;
  bioDraft: string;
  onBioDraftChange: (value: string) => void;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  socialLinksDraft: ProfileSocialLinks;
  onSocialLinkChange: (key: ProfileSocialKey, value: string) => void;
  sportsDraft: string[];
  onToggleSport: (sport: string) => void;
  onChangePhoto: () => void;
  isChangingPhoto?: boolean;
  extraField?: EditableExtraField;
};

export function ProfileHeroSheet({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  scrollY,
  isEditing,
  onRequestEdit,
  onDismissEdit,
  onSave,
  isSaving = false,
  statusLabel,
  bioDraft,
  onBioDraftChange,
  nameDraft,
  onNameDraftChange,
  socialLinksDraft,
  onSocialLinkChange,
  sportsDraft,
  onToggleSport,
  onChangePhoto,
  isChangingPhoto = false,
  extraField,
}: ProfileHeroSheetProps) {
  const { t } = useTranslation();
  const { safeTop } = useAppInsets();
  const editProgress = useSharedValue(isEditing ? 1 : 0);
  const pullToEditArmed = useSharedValue(true);
  const shouldEnablePullToEdit = Platform.OS !== "web";
  const contractedHeight = safeTop + PROFILE_HERO_CONTRACTED_CONTENT_HEIGHT;
  const activeSocialCount = PROFILE_SOCIAL_FIELDS.filter((field) =>
    Boolean(socialLinksDraft[field.key]?.trim()),
  ).length;

  useEffect(() => {
    editProgress.value = withTiming(isEditing ? 1 : 0, { duration: 220 });
  }, [editProgress, isEditing]);

  useAnimatedReaction(
    () => (shouldEnablePullToEdit ? scrollY.value : 0),
    (offset) => {
      if (!shouldEnablePullToEdit) {
        return;
      }
      if (isEditing) {
        pullToEditArmed.value = true;
        return;
      }
      if (offset <= -58 && pullToEditArmed.value) {
        pullToEditArmed.value = false;
        runOnJS(onRequestEdit)();
        return;
      }
      if (offset >= -12) {
        pullToEditArmed.value = true;
      }
    },
    [isEditing, onRequestEdit, pullToEditArmed, scrollY, shouldEnablePullToEdit],
  );

  const sportsLabel =
    sportsDraft.length === 0
      ? t("profile.settings.sports.none")
      : sportsDraft.length <= 2
        ? sportsDraft.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ")
        : `${isSportType(sportsDraft[0] ?? "") ? toSportLabel(sportsDraft[0] as (typeof SPORT_TYPES)[number]) : sportsDraft[0]} +${String(
            sportsDraft.length - 1,
          )}`;

  const editFieldsVisibleStyle = useAnimatedStyle(() => ({
    opacity: editProgress.value,
    maxHeight: interpolate(
      editProgress.value,
      [0, 1],
      [0, PROFILE_HERO_EDIT_CONTENT_HEIGHT],
      Extrapolation.CLAMP,
    ),
    marginTop: interpolate(editProgress.value, [0, 1], [0, 16], Extrapolation.CLAMP),
    overflow: "hidden" as const,
  }));

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
    const expandedHeight =
      safeTop +
      interpolate(
        editProgress.value,
        [0, 1],
        [PROFILE_HERO_EXPANDED_CONTENT_HEIGHT, PROFILE_HERO_EDIT_CONTENT_HEIGHT],
        Extrapolation.CLAMP,
      );
    const collapsedBase = interpolate(
      scrollY.value,
      [0, PROFILE_HERO_COLLAPSE_END],
      [expandedHeight, contractedHeight],
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
          <KitPressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Change profile photo" : "Edit profile"}
            onPress={isEditing ? onChangePhoto : onRequestEdit}
            haptic="selection"
            style={{ borderRadius: 24 }}
          >
            <Animated.View style={profileAvatarStyle}>
              <ProfileAvatar
                imageUrl={profileImageUrl}
                fallbackName={profileName}
                palette={palette}
                size={74}
                roundedSquare
              />
            </Animated.View>
          </KitPressable>

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

          {!isEditing ? (
            <KitButton label="Edit" onPress={onRequestEdit} variant="ghost" size="sm" />
          ) : null}
        </View>

        <View style={{ marginTop: 12, gap: 12 }}>
          {bioDraft.trim().length > 0 ? (
            <Text
              numberOfLines={isEditing ? 3 : 2}
              style={{
                fontFamily: "Rubik_400Regular",
                fontSize: 14,
                lineHeight: 20,
                color: palette.textMuted as string,
              }}
            >
              {bioDraft}
            </Text>
          ) : !isEditing ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Rubik_400Regular",
                fontSize: 14,
                color: palette.textMuted as string,
              }}
            >
              Pull down to edit your public profile.
            </Text>
          ) : null}

          {activeSocialCount > 0 ? (
            <ProfileSocialLinksRow socialLinks={socialLinksDraft} palette={palette} />
          ) : !isEditing ? (
            <Text
              style={{
                fontFamily: "Rubik_500Medium",
                fontSize: 13,
                color: palette.textMicro as string,
              }}
            >
              Add social links so studios and instructors can find you faster.
            </Text>
          ) : null}
        </View>

        <Animated.View style={editFieldsVisibleStyle}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: "Rubik_600SemiBold",
                  fontSize: 16,
                  color: palette.text as string,
                }}
              >
                Edit public profile
              </Text>
              <KitPressable
                accessibilityRole="button"
                accessibilityLabel="Close editing"
                onPress={onDismissEdit}
                style={{ paddingVertical: 6, paddingHorizontal: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Rubik_500Medium",
                    fontSize: 13,
                    color: palette.textMuted as string,
                  }}
                >
                  Close
                </Text>
              </KitPressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: "Rubik_400Regular",
                  fontSize: 13,
                  lineHeight: 18,
                  color: palette.textMuted as string,
                }}
              >
                Change your photo, add what you teach, and link the places people already know you.
              </Text>
              <KitButton
                label={isChangingPhoto ? "Uploading..." : "Photo"}
                onPress={onChangePhoto}
                variant="secondary"
                size="sm"
                disabled={isChangingPhoto}
              />
            </View>

            <KitTextField
              label="Display name"
              value={nameDraft}
              onChangeText={onNameDraftChange}
              placeholder="Name people should see"
              autoCapitalize="words"
              autoCorrect={false}
            />

            <KitTextField
              label="Bio"
              value={bioDraft}
              onChangeText={onBioDraftChange}
              placeholder="What kind of classes, vibe, or training you bring"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 78 }}
            />

            {extraField ? (
              <KitTextField
                label={extraField.label}
                value={extraField.value}
                onChangeText={extraField.onChangeText}
                placeholder={extraField.placeholder}
                keyboardType={extraField.keyboardType}
              />
            ) : null}

            <SportsMultiSelect
              palette={palette}
              selectedSports={sportsDraft}
              onToggleSport={onToggleSport}
              searchPlaceholder={t("mapTab.searchPlaceholder")}
              title={t("profile.settings.sports.title")}
              emptyHint={t("profile.settings.sports.none")}
            />

            <View
              style={{
                borderWidth: 1,
                borderColor: palette.border as string,
                borderRadius: 22,
                borderCurve: "continuous",
                padding: 14,
                gap: 12,
                backgroundColor: palette.surface as string,
              }}
            >
              <Text
                style={{
                  fontFamily: "Rubik_600SemiBold",
                  fontSize: 15,
                  color: palette.text as string,
                }}
              >
                Social links
              </Text>
              {PROFILE_SOCIAL_FIELDS.map((field) => (
                <KitTextField
                  key={field.key}
                  label={field.label}
                  value={socialLinksDraft[field.key] ?? ""}
                  onChangeText={(value) => onSocialLinkChange(field.key, value)}
                  placeholder={`${field.label} link`}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ))}
            </View>

            {statusLabel ? (
              <Text
                style={{
                  fontFamily: "Rubik_400Regular",
                  fontSize: 13,
                  lineHeight: 18,
                  color: palette.textMuted as string,
                }}
              >
                {statusLabel}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <KitButton
                  label={isSaving ? "Saving..." : "Save profile"}
                  onPress={onSave}
                  disabled={isSaving}
                />
              </View>
              <View style={{ flex: 1 }}>
                <KitButton
                  label="Done"
                  onPress={onDismissEdit}
                  variant="secondary"
                  disabled={isSaving}
                />
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
