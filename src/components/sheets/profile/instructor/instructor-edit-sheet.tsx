/**
 * Instructor Edit Profile Sheet - editing instructor profile.
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ProfileEditorForm } from "@/components/profile/profile-editor";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { isProfileImageUploadError, useProfileImageUpload } from "@/hooks/use-profile-image-upload";
import { useTheme } from "@/hooks/use-theme";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import { Box, HStack, Spacer, VStack } from "@/primitives";
import { Motion } from "@/theme/theme";
import { BaseProfileSheet } from "../base-profile-sheet";

// ============================================================
// Skeleton - matches real edit screen layout
// ============================================================

function SkeletonProfile() {
  const { color: theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <Box gap="xl" p="lg">
        {/* Avatar section */}
        <HStack gap="lg" align="center">
          <SkeletonLine width={80} height={80} radius={40} />
          <VStack gap="sm" style={{ flex: 1 }}>
            <SkeletonLine width="60%" height={20} />
            <SkeletonLine width="40%" height={14} />
          </VStack>
        </HStack>

        {/* Form fields */}
        <VStack gap="lg">
          <Box
            p="lg"
            style={{ backgroundColor: theme.surfaceElevated, borderRadius: BrandRadius.soft }}
          >
            <SkeletonLine width="30%" height={12} />
            <Spacer size="sm" />
            <SkeletonLine width="100%" height={40} />
          </Box>
          <Box
            p="lg"
            style={{ backgroundColor: theme.surfaceElevated, borderRadius: BrandRadius.soft }}
          >
            <SkeletonLine width="30%" height={12} />
            <Spacer size="sm" />
            <SkeletonLine width="100%" height={80} />
          </Box>
          <Box
            p="lg"
            style={{ backgroundColor: theme.surfaceElevated, borderRadius: BrandRadius.soft }}
          >
            <SkeletonLine width="40%" height={12} />
            <Spacer size="md" />
            {[1, 2, 3].map((i) => (
              <HStack key={i} gap="md" align="center">
                <Box style={{ marginTop: BrandSpacing.sm }}>
                  <SkeletonLine width={24} height={24} radius={12} />
                </Box>
                <SkeletonLine width="80%" height={14} />
              </HStack>
            ))}
          </Box>
        </VStack>
      </Box>
    </Animated.View>
  );
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

interface InstructorEditSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorEditSheet({ visible, onClose }: InstructorEditSheetProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const theme = useTheme();
  const instructorSettings = useQuery(
    api.instructors.settings.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveProfileCard = useMutation(api.instructors.settings.updateMyInstructorProfileCard);
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

  const isLoading = currentUser?.role !== "instructor" || !instructorSettings;

  const { animatedStyle } = useContentReveal(isLoading);

  // Guard: if still loading, show skeleton
  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
          <SkeletonProfile />
        </Box>
      </BaseProfileSheet>
    );
  }

  const uploadProfilePhoto = async () => {
    if (!instructorSettings) return;
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
    if (!instructorSettings) return;
    setFeedbackLabel(null);
    setIsSavingProfile(true);
    try {
      await saveProfileCard({
        displayName: nameDraft.trim() || instructorSettings!.displayName,
        bio: bioDraft.trim(),
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
      <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <ProfileEditorForm
            profileName={nameDraft || instructorSettings!.displayName}
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
          />
        </Animated.View>
      </Box>
    </BaseProfileSheet>
  );
}
