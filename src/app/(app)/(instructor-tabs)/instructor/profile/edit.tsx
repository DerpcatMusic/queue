import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { LoadingScreen } from "@/components/loading-screen";
import { ProfileEditorForm } from "@/components/profile/profile-editor";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { useProfileSubpageSheet } from "@/components/profile/profile-subpage-sheet";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isProfileImageUploadError, useProfileImageUpload } from "@/hooks/use-profile-image-upload";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";

function toSocialLinksDraft(value: ProfileSocialLinks | undefined) {
  return { ...(value ?? {}) };
}

function areStringArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function areSocialLinksEqual(a: ProfileSocialLinks, b: ProfileSocialLinks) {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (
      (a as Record<string, string | undefined>)[key] !==
      (b as Record<string, string | undefined>)[key]
    ) {
      return false;
    }
  }
  return true;
}

export default function InstructorProfileEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useUser();
  const collapsedSheetHeight = useProfileSubpageSheet({
    title: t("profile.navigation.edit"),
    routeMatchPath: "/profile/edit",
  });
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveProfileCard = useMutation(api.users.updateMyInstructorProfileCard);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [sportsDraft, setSportsDraft] = useState<string[]>([]);
  const [socialLinksDraft, setSocialLinksDraft] = useState<ProfileSocialLinks>({});
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null | undefined>(undefined);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const {
    isUploading: isUploadingProfilePhoto,
    uploadStatusLabel: profilePhotoUploadLabel,
    pickAndUploadProfileImage,
  } = useProfileImageUpload();

  useEffect(() => {
    if (!instructorSettings) return;
    setNameDraft(instructorSettings.displayName);
    setBioDraft(instructorSettings.bio ?? "");
    setSportsDraft(instructorSettings.sports);
    setSocialLinksDraft(toSocialLinksDraft(instructorSettings.socialLinks));
    setProfilePhotoUrl(instructorSettings.profileImageUrl ?? currentUser?.image);
  }, [currentUser?.image, instructorSettings]);

  const hasUnsavedProfileChanges = useMemo(() => {
    if (!instructorSettings) return false;
    return (
      (nameDraft.trim() || instructorSettings.displayName) !== instructorSettings.displayName ||
      bioDraft.trim() !== (instructorSettings.bio ?? "") ||
      !areStringArraysEqual(sportsDraft, instructorSettings.sports) ||
      !areSocialLinksEqual(socialLinksDraft, toSocialLinksDraft(instructorSettings.socialLinks))
    );
  }, [bioDraft, instructorSettings, nameDraft, socialLinksDraft, sportsDraft]);

  if (currentUser?.role !== "instructor" || !instructorSettings) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

  const uploadProfilePhoto = async () => {
    setFeedbackLabel(null);
    try {
      const uploadedUrl = await pickAndUploadProfileImage();
      if (uploadedUrl === undefined) {
        return;
      }
      setProfilePhotoUrl(uploadedUrl);
      setFeedbackLabel(t("profile.editor.photoUpdated"));
    } catch (error) {
      if (isProfileImageUploadError(error) && error.code === "permission_blocked") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: error.message,
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
      setFeedbackLabel(
        error instanceof Error ? error.message : t("profile.editor.photoUpdateFailed"),
      );
    }
  };

  const saveProfile = async () => {
    setFeedbackLabel(null);
    setIsSavingProfile(true);
    try {
      await saveProfileCard({
        displayName: nameDraft.trim() || instructorSettings!.displayName,
        bio: bioDraft.trim(),
        socialLinks: socialLinksDraft,
        sports: sportsDraft,
      });
      router.back();
    } catch (error) {
      setFeedbackLabel(error instanceof Error ? error.message : t("profile.editor.saveFailed"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancel = () => {
    if (!hasUnsavedProfileChanges) {
      router.back();
      return;
    }

    Alert.alert(t("common.discardChanges"), t("common.discardChangesMessage"), [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("common.discard"),
        style: "destructive",
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-app-bg">
      <ProfileEditorForm
        profileName={nameDraft || instructorSettings.displayName}
        roleLabel={t("profile.hero.instructorProfile")}
        profileImageUrl={profilePhotoUrl}
        nameDraft={nameDraft}
        onNameDraftChange={(value) => {
          setFeedbackLabel(null);
          setNameDraft(value);
        }}
        bioDraft={bioDraft}
        onBioDraftChange={(value) => {
          setFeedbackLabel(null);
          setBioDraft(value);
        }}
        socialLinksDraft={socialLinksDraft}
        onSocialLinkChange={(key, value) => {
          setFeedbackLabel(null);
          setSocialLinksDraft((current) => ({ ...current, [key]: value }));
        }}
        sportsDraft={sportsDraft}
        onToggleSport={(sport) => {
          setFeedbackLabel(null);
          setSportsDraft((current) =>
            current.includes(sport)
              ? current.filter((entry) => entry !== sport)
              : [...current, sport],
          );
        }}
        onChangePhoto={() => {
          void uploadProfilePhoto();
        }}
        onCancel={handleCancel}
        onSave={() => {
          void saveProfile();
        }}
        isSaving={isSavingProfile}
        isChangingPhoto={isUploadingProfilePhoto}
        statusLabel={profilePhotoUploadLabel ?? feedbackLabel}
        searchPlaceholder={t("profile.settings.sports.searchPlaceholder")}
        sportsTitle={t("profile.settings.sports.title")}
        sportsEmptyHint={t("profile.settings.sports.none")}
        contentTopInset={collapsedSheetHeight + BrandSpacing.lg}
      />
    </View>
  );
}
