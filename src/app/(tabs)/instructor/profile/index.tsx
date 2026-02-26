import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useProfileImageUpload } from "@/hooks/use-profile-image-upload";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

export default function InstructorProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference, resolvedScheme } = useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null | undefined>(undefined);
  const [profilePhotoStatus, setProfilePhotoStatus] = useState<string | null>(null);
  const { isUploading: isUploadingProfilePhoto, pickAndUploadProfileImage } =
    useProfileImageUpload();

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" && hasActivated ? {} : "skip",
  );
  const payoutSummary = useQuery(
    api.payments.getMyPayoutSummary,
    currentUser?.role === "instructor" && hasActivated ? {} : "skip",
  );
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    currentUser?.role === "instructor" && hasActivated ? {} : "skip",
  );

  useEffect(() => {
    const nextUrl = instructorSettings?.profileImageUrl ?? currentUser?.image;
    setProfilePhotoUrl(nextUrl);
  }, [currentUser?.image, instructorSettings?.profileImageUrl]);

  if (!hasActivated) return <LoadingScreen />;

  const nameValue = currentUser?.fullName ?? t("profile.account.fallbackName");
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

  const sports = instructorSettings?.sports ?? [];
  const sportsSummary =
    sports.length === 0
      ? t("profile.settings.sports.none")
      : sports.length <= 2
        ? sports
            .map((sport: string) => (isSportType(sport) ? toSportLabel(sport) : sport))
            .join(", ")
        : t("profile.settings.sports.selected", { count: sports.length });

  const addr = instructorSettings?.address;
  const locationSummary = !addr
    ? t("profile.settings.location.zoneNotDetected")
    : addr.length > 35
      ? `${addr.slice(0, 32)}...`
      : addr;

  const provider = instructorSettings?.calendarProvider;
  const calendarSummary =
    !provider || provider === "none"
      ? t("profile.settings.calendar.provider.none")
      : provider === "google"
        ? "Google"
        : t("profile.roles.unknown");

  const bankConnected = payoutSummary?.hasVerifiedDestination ?? false;
  const paymentSummary = bankConnected ? "Bank connected" : "Bank not connected";
  const identityStatus = diditVerification?.status ?? "not_started";
  const identityVerified = diditVerification?.isVerified ?? false;
  const identitySummary = identityVerified
    ? "Identity verified"
    : identityStatus === "declined"
      ? "Verification declined"
      : identityStatus === "in_review" || identityStatus === "pending"
        ? "Verification in review"
        : identityStatus === "in_progress"
          ? "Verification in progress"
          : "Not verified";

  const chevron = <IconSymbol name="chevron.right" size={14} color={palette.textMicro} />;

  const uploadProfilePhoto = async () => {
    setProfilePhotoStatus(null);
    try {
      const uploadedUrl = await pickAndUploadProfileImage();
      if (uploadedUrl === undefined) {
        return;
      }
      setProfilePhotoUrl(uploadedUrl);
      setProfilePhotoStatus("Profile photo updated.");
    } catch (error) {
      setProfilePhotoStatus(
        error instanceof Error ? error.message : "Failed to update profile photo.",
      );
    }
  };

  return (
    <RoleRouteGate requiredRole="instructor" redirectHref="/(tabs)/studio/profile">
      <TabScreenScrollView
        routeKey="instructor/profile"
        key={resolvedScheme}
        style={[styles.screen, { backgroundColor: palette.appBg }]}
        contentContainerStyle={styles.content}
      >
        <SectionHeader label={t("profile.account.title")} palette={palette} />
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 18,
              paddingHorizontal: 20,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <ProfileAvatar
              imageUrl={profilePhotoUrl}
              fallbackName={nameValue}
              palette={palette}
              size={58}
              roundedSquare
            />
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText
                style={{ fontSize: 16, fontWeight: "500", color: palette.text, letterSpacing: -0.1 }}
              >
                Profile photo
              </ThemedText>
              <ThemedText
                style={{ color: palette.textMuted, fontSize: 13, fontWeight: "400" }}
              >
                Used on your home banner and job cards.
              </ThemedText>
            </View>
            <Pressable
              onPress={() => {
                void uploadProfilePhoto();
              }}
              disabled={isUploadingProfilePhoto}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: palette.borderStrong,
                  backgroundColor: pressed ? (palette.surfaceAlt as string) : "transparent",
                  borderRadius: 999,
                  borderCurve: "continuous",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                },
              ]}
            >
              <ThemedText
                style={{ color: palette.text, fontSize: 13, fontWeight: "500" }}
              >
                {isUploadingProfilePhoto ? "Uploading..." : "Change"}
              </ThemedText>
            </Pressable>
          </View>
          <ProfileRow
            title={t("profile.account.nameLabel")}
            subtitle={nameValue}
            palette={palette}
          />
          {identityVerified ? (
            <ProfileRow title="KYC" subtitle="Verified legal identity" palette={palette} />
          ) : null}
          <ProfileRow
            title={t("profile.account.emailLabel")}
            subtitle={emailValue}
            palette={palette}
          />
          <ProfileRow
            title={t("profile.account.roleLabel")}
            subtitle={roleValue}
            palette={palette}
            isLast={!memberSince}
          />
          {memberSince && (
            <ProfileRow
              title={t("profile.account.memberSince")}
              subtitle={memberSince}
              palette={palette}
              isLast
            />
          )}
        </View>
        {profilePhotoStatus ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
            <ThemedText style={{ color: palette.textMuted, fontSize: 13 }}>
              {profilePhotoStatus}
            </ThemedText>
          </View>
        ) : null}

        <SectionHeader label={t("profile.appearance.title")} palette={palette} />
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
          ]}
        >
          <ProfileRow
            title={t("profile.language.title")}
            subtitle={language === "en" ? t("language.english") : t("language.hebrew")}
            onPress={() => void setLanguage(language === "en" ? "he" : "en")}
            palette={palette}
            accessory={chevron}
          />
          <ProfileRow
            title={t("profile.appearance.systemTheme.title")}
            subtitle=""
            palette={palette}
            accessory={
              <Switch
                value={preference === "system"}
                onValueChange={(val) => setPreference(val ? "system" : "light")}
                trackColor={{ true: palette.primary, false: palette.borderStrong }}
              />
            }
          />
          <ProfileRow
            title={t("profile.appearance.darkMode.title")}
            subtitle=""
            palette={palette}
            isLast
            accessory={
              <Switch
                disabled={preference === "system"}
                value={preference === "dark"}
                onValueChange={(val) => setPreference(val ? "dark" : "light")}
                trackColor={{ true: palette.primary, false: palette.borderStrong }}
              />
            }
          />
        </View>

        <SectionHeader label="Payments" palette={palette} />
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
          ]}
        >
          <ProfileRow
            title="Payments & payouts"
            subtitle={paymentSummary}
            onPress={() => router.push("/(tabs)/instructor/profile/payments")}
            palette={palette}
            accessory={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: bankConnected ? (palette.success as string) : palette.warning,
                  }}
                />
                {chevron}
              </View>
            }
          />
          <ProfileRow
            title="Identity verification"
            subtitle={identitySummary}
            onPress={() => router.push("/(tabs)/instructor/profile/identity-verification")}
            palette={palette}
            isLast
            accessory={chevron}
          />
        </View>

        <SectionHeader label={t("profile.settings.title")} palette={palette} />
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
          ]}
        >
          <ProfileRow
            title={t("profile.settings.sports.title")}
            subtitle={sportsSummary}
            onPress={() => router.push("/(tabs)/instructor/profile/sports")}
            palette={palette}
            accessory={chevron}
          />
          <ProfileRow
            title={t("profile.settings.location.title")}
            subtitle={locationSummary}
            onPress={() => router.push("/(tabs)/instructor/profile/location")}
            palette={palette}
            accessory={chevron}
          />
          <ProfileRow
            title={t("profile.settings.calendar.title")}
            subtitle={calendarSummary}
            onPress={() => router.push("/(tabs)/instructor/profile/calendar-settings")}
            palette={palette}
            isLast
            accessory={chevron}
          />
        </View>

        <View style={{ marginTop: 40, marginBottom: 40 }}>
          <View
            style={[
              styles.cardGroup,
              { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
            ]}
          >
            <ProfileRow
              title={t("auth.signOutButton")}
              subtitle=""
              onPress={() => void signOut()}
              palette={palette}
              isLast
              accessory={<IconSymbol name="arrow.right.square" size={24} color={palette.danger} />}
            />
          </View>
        </View>
      </TabScreenScrollView>
    </RoleRouteGate>
  );
}

type SectionHeaderProps = {
  label: string;
  palette: BrandPalette;
};

function SectionHeader({ label, palette }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText
        type="title"
        style={{
          color: palette.text,
          fontWeight: "600",
          letterSpacing: -0.2,
          fontSize: 20,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

function ProfileRow({
  title,
  subtitle,
  accessory,
  onPress,
  palette,
  isLast = false,
}: {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  onPress?: () => void;
  palette: BrandPalette;
  isLast?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <ThemedText
          style={{ fontSize: 16, fontWeight: "500", color: palette.text, letterSpacing: -0.1 }}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={{ color: palette.textMuted, fontSize: 13, fontWeight: "400", marginTop: 4 }}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {accessory && <View>{accessory}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: pressed ? (palette.surfaceAlt as string) : "transparent" },
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 0,
    paddingVertical: 16,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardGroup: {
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: "hidden",
  },
});
