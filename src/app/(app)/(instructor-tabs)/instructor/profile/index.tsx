import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, View } from "react-native";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { IdentityStatusBadge } from "@/components/profile/identity-status-ui";
import {
  getProfileHeroScrollTopPadding,
  ProfileHeroSheet,
} from "@/components/profile/profile-hero-sheet";
import {
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;
const INSTRUCTOR_PROFILE_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile);
const INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE =
  `${INSTRUCTOR_PROFILE_ROUTE}/identity-verification` as const;
const INSTRUCTOR_SPORTS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/sports` as const;
const INSTRUCTOR_LOCATION_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/location` as const;
const INSTRUCTOR_CALENDAR_SETTINGS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/calendar-settings` as const;
const INSTRUCTOR_PAYMENTS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/payments` as const;
const INSTRUCTOR_EDIT_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/edit` as const;

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

export default function InstructorProfileScreen() {
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

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  useEffect(() => {
    if (edit === "1") {
      router.replace(INSTRUCTOR_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "instructor" && hasActivated;

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const payoutSummary = useQuery(
    api.payments.getMyPayoutSummary,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    shouldLoadSettings ? emptyArgs : "skip",
  );

  const handleRequestEdit = useCallback(() => {
    router.push(INSTRUCTOR_EDIT_ROUTE as Href);
  }, [router]);

  if (!hasActivated || (currentUser?.role === "instructor" && instructorSettings === undefined)) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

  const nameValue =
    instructorSettings?.displayName ?? currentUser?.fullName ?? t("profile.account.fallbackName");
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

  const identityStatus = diditVerification?.status ?? "not_started";
  const identityVerified = diditVerification?.isVerified ?? false;
  const bankConnected = payoutSummary?.hasVerifiedDestination ?? false;
  const sportsSummary = getSportsSummary(instructorSettings?.sports ?? [], t);
  const locationSummary = instructorSettings?.address
    ? instructorSettings.address.length > 35
      ? `${instructorSettings.address.slice(0, 32)}...`
      : instructorSettings.address
    : t("profile.settings.location.zoneNotDetected");
  const provider = instructorSettings?.calendarProvider;
  const calendarSummary =
    !provider || provider === "none"
      ? t("profile.settings.calendar.provider.none")
      : provider === "google"
        ? "Google"
        : "Apple";
  const socialCount = Object.keys(instructorSettings?.socialLinks ?? {}).length;

  return (
    <View collapsable={false} style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="instructor/profile"
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
            subtitle={
              socialCount > 0 ? `${sportsSummary}. ${String(socialCount)} links` : sportsSummary
            }
            onPress={handleRequestEdit}
            palette={palette}
          />
          <ProfileSettingRow
            title="Identity"
            subtitle={identityVerified ? "Verified and ready" : "Manage your Didit verification"}
            onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
            palette={palette}
            accessory={<IdentityStatusBadge status={identityStatus} palette={palette} />}
          />
          <ProfileSettingRow
            title={t("profile.settings.sports.title")}
            subtitle={sportsSummary}
            onPress={() => router.push(INSTRUCTOR_SPORTS_ROUTE as Href)}
            palette={palette}
          />
          <ProfileSettingRow
            title={t("profile.settings.location.title")}
            subtitle={locationSummary}
            onPress={() => router.push(INSTRUCTOR_LOCATION_ROUTE as Href)}
            palette={palette}
          />
          <ProfileSettingRow
            title={t("profile.settings.calendar.title")}
            subtitle={calendarSummary}
            onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
            palette={palette}
            isLast
          />
        </ProfileCardGroup>

        <ProfileSectionHeader label={t("profile.account.title")} palette={palette} />
        <ProfileCardGroup palette={palette}>
          <ProfileSettingRow
            title={t("profile.account.nameLabel")}
            subtitle={currentUser?.fullName ?? nameValue}
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
            subtitle={bankConnected ? "Bank connected" : "Bank not connected"}
            onPress={() => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href)}
            palette={palette}
            isLast
            accessory={
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: bankConnected
                    ? (palette.success as string)
                    : (palette.warning as string),
                }}
              />
            }
          />
        </ProfileCardGroup>

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
        profileName={nameValue}
        roleLabel={identityVerified ? "Verified instructor" : "Instructor profile"}
        profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
        palette={palette}
        scrollY={scrollY}
        onRequestEdit={handleRequestEdit}
        bio={instructorSettings?.bio}
        socialLinks={instructorSettings?.socialLinks}
        sports={instructorSettings?.sports ?? []}
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
