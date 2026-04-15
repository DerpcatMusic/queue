/**
 * Studio Edit Sheet - studio profile editing via bottom sheet.
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileEditorForm } from "@/components/profile/profile-editor";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isProfileImageUploadError, useProfileImageUpload } from "@/hooks/use-profile-image-upload";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";

interface StudioEditSheetProps {
  visible: boolean;
  onClose: () => void;
}

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

export function StudioEditSheet({ visible, onClose }: StudioEditSheetProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const studioSettings = useQuery(
    api.studios.settings.getMyStudioSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );
  const saveProfileCard = useMutation(api.studios.settings.updateMyStudioProfileCard);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [contactPhoneDraft, setContactPhoneDraft] = useState("");
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
    if (!studioSettings) return;
    setNameDraft(studioSettings.studioName);
    setBioDraft(studioSettings.bio ?? "");
    setContactPhoneDraft(studioSettings.contactPhone ?? "");
    setSportsDraft(studioSettings.sports);
    setSocialLinksDraft(toSocialLinksDraft(studioSettings.socialLinks));
    setProfilePhotoUrl(studioSettings.profileImageUrl ?? currentUser?.image);
  }, [currentUser?.image, studioSettings]);

  const hasUnsavedProfileChanges = useMemo(() => {
    if (!studioSettings) return false;
    return (
      (nameDraft.trim() || studioSettings.studioName) !== studioSettings.studioName ||
      bioDraft.trim() !== (studioSettings.bio ?? "") ||
      contactPhoneDraft.trim() !== (studioSettings.contactPhone ?? "") ||
      !areStringArraysEqual(sportsDraft, studioSettings.sports) ||
      !areSocialLinksEqual(socialLinksDraft, toSocialLinksDraft(studioSettings.socialLinks))
    );
  }, [bioDraft, contactPhoneDraft, nameDraft, socialLinksDraft, sportsDraft, studioSettings]);

  if (currentUser?.role !== "studio" || !studioSettings) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
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
        studioName: nameDraft.trim() || studioSettings!.studioName,
        bio: bioDraft.trim(),
        contactPhone: contactPhoneDraft.trim(),
        socialLinks: socialLinksDraft,
        sports: sportsDraft,
      });
      onClose();
    } catch (error) {
      setFeedbackLabel(error instanceof Error ? error.message : t("profile.editor.saveFailed"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancel = () => {
    if (!hasUnsavedProfileChanges) {
      onClose();
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
        onPress: () => onClose(),
      },
    ]);
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <ProfileEditorForm
        profileName={nameDraft || studioSettings.studioName}
        roleLabel={t("profile.hero.studioProfile")}
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
        extraField={{
          label: t("profile.editor.contactPhoneLabel"),
          placeholder: t("profile.editor.contactPhonePlaceholder"),
          value: contactPhoneDraft,
          onChangeText: (value) => {
            setFeedbackLabel(null);
            setContactPhoneDraft(value);
          },
          keyboardType: "phone-pad",
        }}
      />
    </BaseProfileSheet>
  );
}
