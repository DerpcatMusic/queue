import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, View } from "react-native";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  getProfileHeroScrollTopPadding,
  ProfileHeroSheet,
} from "@/components/profile/profile-hero-sheet";
import {
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useProfileImageUpload } from "@/hooks/use-profile-image-upload";
import { useThemePreference } from "@/hooks/use-theme-preference";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

function toSocialLinksDraft(value: ProfileSocialLinks | undefined) {
  return { ...(value ?? {}) };
}

function getSportsSummary(sports: string[], t: TFunction) {
  if (sports.length === 0) {
    return t("profile.settings.sports.none");
  }
  if (sports.length <= 2) {
    return sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ");
  }
  return t("profile.settings.sports.selected", { count: sports.length });
}

function ProfileCardGroup({ children, palette }: { children: ReactNode; palette: BrandPalette }) {
  return (
    <View
      style={[
        styles.cardGroup,
        { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
      ]}
    >
      {children}
    </View>
  );
}

export default function StudioProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { safeTop } = useAppInsets();
  const { preference, setPreference } = useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const [hasActivated, setHasActivated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [contactPhoneDraft, setContactPhoneDraft] = useState("");
  const [sportsDraft, setSportsDraft] = useState<string[]>([]);
  const [socialLinksDraft, setSocialLinksDraft] = useState<ProfileSocialLinks>({});
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null | undefined>(undefined);
  const {
    isUploading: isUploadingProfilePhoto,
    uploadStatusLabel: profilePhotoUploadLabel,
    pickAndUploadProfileImage,
  } = useProfileImageUpload();
  const saveProfileCard = useMutation(api.users.updateMyStudioProfileCard);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  useEffect(() => {
    if (edit === "1") {
      setIsEditing(true);
    }
  }, [edit]);

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    currentUser?.role === "studio" && hasActivated ? {} : "skip",
  );

  useEffect(() => {
    if (!studioSettings) {
      return;
    }
    setNameDraft(studioSettings.studioName);
    setBioDraft(studioSettings.bio ?? "");
    setContactPhoneDraft(studioSettings.contactPhone ?? "");
    setSportsDraft(studioSettings.sports);
    setSocialLinksDraft(toSocialLinksDraft(studioSettings.socialLinks));
    setProfilePhotoUrl(studioSettings.profileImageUrl ?? currentUser?.image);
  }, [currentUser?.image, studioSettings]);

  if (!hasActivated || (currentUser?.role === "studio" && studioSettings === undefined)) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

  const profileName =
    studioSettings?.studioName ?? currentUser?.fullName ?? t("profile.account.fallbackName");
  const emailValue = currentUser?.email ?? t("profile.account.fallbackEmail");
  const roleValue = t(
    ROLE_TRANSLATION_KEYS[currentUser?.role as keyof typeof ROLE_TRANSLATION_KEYS] ??
      "profile.roles.pending",
  );
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? "en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const profileStatusLabel = profilePhotoUploadLabel ?? feedbackLabel;
  const sportsSummary = getSportsSummary(studioSettings?.sports ?? [], t);
  const socialCount = Object.keys(studioSettings?.socialLinks ?? {}).length;
  const chevron = <IconSymbol name="chevron.right" size={14} color={palette.textMicro} />;

  const onToggleSport = (sport: string) => {
    setFeedbackLabel(null);
    setSportsDraft((current) =>
      current.includes(sport) ? current.filter((entry) => entry !== sport) : [...current, sport],
    );
  };

  const onSocialLinkChange = (key: keyof ProfileSocialLinks, value: string) => {
    setFeedbackLabel(null);
    setSocialLinksDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const uploadProfilePhoto = async () => {
    setFeedbackLabel(null);
    try {
      const uploadedUrl = await pickAndUploadProfileImage();
      if (uploadedUrl === undefined) {
        return;
      }
      setProfilePhotoUrl(uploadedUrl);
      setFeedbackLabel("Profile photo updated.");
    } catch (error) {
      setFeedbackLabel(error instanceof Error ? error.message : "Failed to update profile photo.");
    }
  };

  const saveProfile = async () => {
    setFeedbackLabel(null);
    setIsSavingProfile(true);
    try {
      await saveProfileCard({
        studioName: nameDraft.trim() || profileName,
        bio: bioDraft.trim(),
        contactPhone: contactPhoneDraft.trim(),
        socialLinks: socialLinksDraft,
        sports: sportsDraft,
      });
      setFeedbackLabel("Profile updated.");
      setIsEditing(false);
    } catch (error) {
      setFeedbackLabel(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <View collapsable={false} style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="studio/profile"
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: getProfileHeroScrollTopPadding(safeTop),
          paddingBottom: 40,
        }}
      >
        <ProfileSectionHeader label="Profile" palette={palette} />
        <ProfileCardGroup palette={palette}>
          <ProfileSettingRow
            title="Public profile"
            subtitle={`${sportsSummary}${socialCount > 0 ? ` * ${String(socialCount)} links` : ""}`}
            onPress={() => setIsEditing(true)}
            palette={palette}
            accessory={chevron}
          />
          <ProfileSettingRow
            title="Studio details"
            subtitle={studioSettings?.address ?? "Complete onboarding to set your address"}
            palette={palette}
          />
          <ProfileSettingRow
            title="Coverage zone"
            subtitle={studioSettings?.zone ?? "No zone"}
            palette={palette}
          />
          <ProfileSettingRow
            title="Auto-expire jobs"
            subtitle={`${String(studioSettings?.autoExpireMinutesBefore ?? 30)} minutes before start`}
            palette={palette}
            isLast
          />
        </ProfileCardGroup>

        <ProfileSectionHeader label={t("profile.account.title")} palette={palette} />
        <ProfileCardGroup palette={palette}>
          <ProfileSettingRow
            title={t("profile.account.nameLabel")}
            subtitle={currentUser?.fullName ?? profileName}
            palette={palette}
          />
          <ProfileSettingRow
            title={t("profile.account.emailLabel")}
            subtitle={emailValue}
            palette={palette}
          />
          <ProfileSettingRow
            title={t("profile.account.roleLabel")}
            subtitle={roleValue}
            palette={palette}
            isLast={!memberSince}
          />
          {memberSince ? (
            <ProfileSettingRow
              title={t("profile.account.memberSince")}
              subtitle={memberSince}
              palette={palette}
              isLast
            />
          ) : null}
        </ProfileCardGroup>

        <ProfileSectionHeader label={t("profile.appearance.title")} palette={palette} />
        <ProfileCardGroup palette={palette}>
          <ProfileSettingRow
            title={t("profile.language.title")}
            subtitle={language === "en" ? t("language.english") : t("language.hebrew")}
            onPress={() => void setLanguage(language === "en" ? "he" : "en")}
            palette={palette}
            accessory={chevron}
          />
          <ProfileSettingRow
            title={t("profile.appearance.systemTheme.title")}
            palette={palette}
            accessory={
              <Switch
                value={preference === "system"}
                onValueChange={(value) => setPreference(value ? "system" : "light")}
                trackColor={{
                  true: palette.primary as string,
                  false: palette.borderStrong as string,
                }}
              />
            }
          />
          <ProfileSettingRow
            title={t("profile.appearance.darkMode.title")}
            palette={palette}
            isLast
            accessory={
              <Switch
                disabled={preference === "system"}
                value={preference === "dark"}
                onValueChange={(value) => setPreference(value ? "dark" : "light")}
                trackColor={{
                  true: palette.primary as string,
                  false: palette.borderStrong as string,
                }}
              />
            }
          />
        </ProfileCardGroup>

        <ProfileSectionHeader label="Payments" palette={palette} />
        <ProfileCardGroup palette={palette}>
          <ProfileSettingRow
            title="Payments & payouts"
            onPress={() => router.push("/studio/profile/payments")}
            palette={palette}
            isLast
            accessory={chevron}
          />
        </ProfileCardGroup>

        {profileStatusLabel ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <ThemedText style={{ color: palette.textMuted, fontSize: 13 }}>
              {profileStatusLabel}
            </ThemedText>
          </View>
        ) : null}

        <View style={{ marginTop: 32, marginBottom: 40 }}>
          <ProfileCardGroup palette={palette}>
            <ProfileSettingRow
              title={t("auth.signOutButton")}
              onPress={() => void signOut()}
              palette={palette}
              isLast
              accessory={<IconSymbol name="arrow.right.square" size={24} color={palette.danger} />}
            />
          </ProfileCardGroup>
        </View>
      </TabScreenScrollView>

      <ProfileHeroSheet
        profileName={nameDraft || profileName}
        roleLabel="Studio profile"
        profileImageUrl={profilePhotoUrl}
        palette={palette}
        scrollY={scrollY}
        isEditing={isEditing}
        onRequestEdit={() => setIsEditing(true)}
        onDismissEdit={() => setIsEditing(false)}
        onSave={() => {
          void saveProfile();
        }}
        isSaving={isSavingProfile}
        statusLabel={profileStatusLabel}
        bioDraft={bioDraft}
        onBioDraftChange={(value) => {
          setFeedbackLabel(null);
          setBioDraft(value);
        }}
        nameDraft={nameDraft}
        onNameDraftChange={(value) => {
          setFeedbackLabel(null);
          setNameDraft(value);
        }}
        socialLinksDraft={socialLinksDraft}
        onSocialLinkChange={onSocialLinkChange}
        sportsDraft={sportsDraft}
        onToggleSport={onToggleSport}
        onChangePhoto={() => {
          void uploadProfilePhoto();
        }}
        isChangingPhoto={isUploadingProfilePhoto}
        extraField={{
          label: "Contact phone",
          placeholder: "Best number for instructors",
          value: contactPhoneDraft,
          onChangeText: (value) => {
            setFeedbackLabel(null);
            setContactPhoneDraft(value);
          },
          keyboardType: "phone-pad",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  cardGroup: {
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: "hidden",
  },
});
