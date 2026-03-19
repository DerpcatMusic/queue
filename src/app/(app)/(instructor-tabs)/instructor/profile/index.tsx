import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";

import {
  getProfileHeroScrollTopPadding,
  ProfileDesktopHeroPanel,
  ProfileHeroSheet,
} from "@/components/profile/profile-hero-sheet";
import { ProfileReadinessBanner } from "@/components/profile/profile-readiness-banner";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { KitSwitch } from "@/components/ui/kit";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
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

function getIdentityVerificationSummary(
  status:
    | "approved"
    | "declined"
    | "in_review"
    | "pending"
    | "in_progress"
    | "abandoned"
    | "expired"
    | "not_started"
    | undefined,
  t: TFunction,
) {
  switch (status) {
    case "approved":
      return t("profile.identityVerification.headline.approved");
    case "declined":
      return t("profile.identityVerification.headline.declined");
    case "in_review":
      return t("profile.identityVerification.headline.in_review");
    case "pending":
      return t("profile.identityVerification.headline.pending");
    case "in_progress":
      return t("profile.identityVerification.headline.in_progress");
    case "abandoned":
      return t("profile.identityVerification.headline.abandoned");
    case "expired":
      return t("profile.identityVerification.headline.expired");
    default:
      return t("profile.identityVerification.headline.default");
  }
}

export default function InstructorProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference } = useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { safeTop } = useAppInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const [hasActivated, setHasActivated] = useState(false);
  const isBodyReady = useDeferredTabMount(isFocused, { delayMs: 72 });

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
  const shouldLoadSettings = currentUser?.role === "instructor" && hasActivated && isBodyReady;

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

  const identityVerified = diditVerification?.isVerified ?? false;
  const identityVerificationSummary = getIdentityVerificationSummary(diditVerification?.status, t);
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
        ? t("profile.settings.calendar.provider.google")
        : t("profile.settings.calendar.provider.apple");
  const sportsCount = instructorSettings?.sports?.length ?? 0;
  const socialCount = Object.keys(instructorSettings?.socialLinks ?? {}).length;
  const setupActions = [
    !identityVerified
      ? {
          label: t("profile.setup.verifyIdentity"),
          onPress: () => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href),
          icon: "checkmark.circle.fill" as const,
        }
      : null,
    !bankConnected
      ? {
          label: t("profile.setup.connectPayouts"),
          onPress: () => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href),
          icon: "sparkles" as const,
        }
      : null,
    sportsCount === 0
      ? {
          label: t("profile.setup.chooseSports"),
          onPress: () => router.push(INSTRUCTOR_SPORTS_ROUTE as Href),
          icon: "sparkles" as const,
        }
      : null,
    !provider || provider === "none"
      ? {
          label: t("profile.setup.linkCalendar"),
          onPress: () => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href),
          icon: "calendar.badge.clock" as const,
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      onPress: () => void;
      icon: "sparkles" | "checkmark.circle.fill" | "calendar.badge.clock";
    } => item !== null,
  );
  const primarySetupAction = setupActions[0] ?? null;

  const setupStatusLabel =
    setupActions.length === 0
      ? t("profile.setup.statusReady")
      : t("profile.setup.statusPending", {
          count: setupActions.length,
        });

  const publicProfileSummary =
    instructorSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", { count: socialCount })
      : t("profile.settings.publicProfilePrompt"));

  const profileSheetConfig = useMemo(
    () => ({
      render: ({ scrollY }: { scrollY: SharedValue<number> }) => (
        <ProfileHeroSheet
          profileName={nameValue}
          roleLabel={
            identityVerified
              ? t("profile.hero.verifiedInstructor")
              : t("profile.hero.instructorProfile")
          }
          profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
          palette={palette}
          scrollY={scrollY}
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit")}
          {...(primarySetupAction ? { secondaryAction: primarySetupAction } : {})}
          statusLabel={setupStatusLabel}
          bio={instructorSettings?.bio}
          socialLinks={instructorSettings?.socialLinks}
          sports={instructorSettings?.sports ?? []}
        />
      ),
    }),
    [
      currentUser?.image,
      handleRequestEdit,
      identityVerified,
      instructorSettings?.bio,
      instructorSettings?.profileImageUrl,
      instructorSettings?.socialLinks,
      instructorSettings?.sports,
      nameValue,
      palette,
      primarySetupAction,
      setupStatusLabel,
      t,
    ],
  );

  useGlobalTopSheet("profile", isDesktopWeb ? null : profileSheetConfig);

  if (
    !hasActivated ||
    !isBodyReady ||
    (currentUser?.role === "instructor" && instructorSettings === undefined)
  ) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="sheet"
        style={[styles.screen, { backgroundColor: palette.appBg }]}
      >
        <View style={{ flex: 1, backgroundColor: palette.appBg as string }} />
      </TabScreenRoot>
    );
  }

  return (
    <TabScreenRoot
      mode="static"
      topInsetTone="sheet"
      style={[styles.screen, { backgroundColor: palette.appBg }]}
    >
      {isDesktopWeb ? (
        <View style={styles.desktopShell}>
          <View style={styles.desktopRail}>
            <ProfileDesktopHeroPanel
              profileName={nameValue}
              roleLabel={
                identityVerified
                  ? t("profile.hero.verifiedInstructor")
                  : t("profile.hero.instructorProfile")
              }
              profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
              palette={palette}
              summary={publicProfileSummary}
              statusLabel={setupStatusLabel}
              metaLabel={
                memberSince
                  ? t("profile.account.memberSinceValue", {
                      date: memberSince,
                    })
                  : sportsSummary
              }
              primaryAction={{
                label: t("profile.actions.edit"),
                onPress: handleRequestEdit,
              }}
              {...(primarySetupAction ? { secondaryAction: primarySetupAction } : {})}
            />
          </View>

          <View style={styles.desktopContent}>
            <View style={styles.desktopMainColumn}>
              <ProfileReadinessBanner
                palette={palette}
                primaryAction={primarySetupAction}
                statusLabel={setupStatusLabel}
                subtitleLabel={
                  primarySetupAction
                    ? t("profile.setup.nextStep", {
                        step: primarySetupAction.label.toLowerCase(),
                      })
                    : t("profile.setup.allClear")
                }
              />

              <ProfileSectionHeader
                label={t("profile.sections.professional")}
                icon="person.crop.circle.fill"
                palette={palette}
                flush
              />
              <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.settings.publicProfile")}
                  subtitle={publicProfileSummary}
                  icon="person.crop.circle.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.sports.title")}
                  subtitle={sportsSummary}
                  icon="gym.bag.fill"
                  onPress={() => router.push(INSTRUCTOR_SPORTS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.location.title")}
                  subtitle={locationSummary}
                  icon="mappin.and.ellipse"
                  onPress={() => router.push(INSTRUCTOR_LOCATION_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
              </ProfileSectionCard>
            </View>

            <View style={styles.desktopSideColumn}>
              <ProfileSectionHeader
                label={t("profile.account.title")}
                icon="person.crop.circle.fill"
                palette={palette}
                flush
              />
              <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.settings.nameLabel")}
                  value={currentUser?.fullName ?? nameValue}
                  icon="person.crop.circle.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.emailLabel")}
                  value={emailValue}
                  icon="paperplane.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.roleLabel")}
                  value={roleValue}
                  icon="checkmark.circle.fill"
                  palette={palette}
                  showDivider
                />
                {memberSince ? (
                  <ProfileSettingRow
                    title={t("profile.account.memberSince")}
                    value={memberSince}
                    icon="calendar.circle.fill"
                    palette={palette}
                    showDivider
                  />
                ) : null}
                <ProfileSettingRow
                  title={t("profile.language.title")}
                  value={language === "en" ? t("language.english") : t("language.hebrew")}
                  icon="globe"
                  onPress={() => void setLanguage(language === "en" ? "he" : "en")}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.appearance.systemTheme.title")}
                  icon="slider.horizontal.3"
                  palette={palette}
                  showDivider
                  accessory={
                    <KitSwitch
                      value={preference === "system"}
                      onValueChange={(value) => setPreference(value ? "system" : "light")}
                    />
                  }
                />
                <ProfileSettingRow
                  title={t("profile.appearance.darkMode.title")}
                  icon="moon.fill"
                  palette={palette}
                  accessory={
                    <KitSwitch
                      disabled={preference === "system"}
                      value={preference === "dark"}
                      onValueChange={(value) => setPreference(value ? "dark" : "light")}
                    />
                  }
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.sections.operations")}
                icon="slider.horizontal.3"
                palette={palette}
                flush
              />
              <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.navigation.identityVerification")}
                  subtitle={identityVerificationSummary}
                  icon="checkmark.circle.fill"
                  onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.badge.clock"
                  onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts")}
                  subtitle={
                    bankConnected
                      ? t("profile.settings.payoutsConnected")
                      : t("profile.settings.payoutsNeeded")
                  }
                  icon="creditcard.fill"
                  onPress={() => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("auth.signOutButton")}
                  subtitle={t("profile.settings.signOutDesc")}
                  icon="arrow.right.square"
                  onPress={() => void signOut()}
                  palette={palette}
                  tone="danger"
                />
              </ProfileSectionCard>
            </View>
          </View>
        </View>
      ) : (
        <TabScreenScrollView
          animatedRef={scrollRef}
          onScroll={onScroll}
          routeKey="instructor/profile"
          style={styles.screen}
          contentContainerStyle={{
            paddingTop: getProfileHeroScrollTopPadding(safeTop),
            paddingHorizontal: 0,
            paddingBottom: 40,
            gap: 24,
          }}
        >
          <View style={styles.mobileContentPadding}>
            <View style={{ marginBottom: 32 }}>
              <ProfileReadinessBanner
                palette={palette}
                primaryAction={primarySetupAction}
                statusLabel={setupStatusLabel}
                subtitleLabel={
                  primarySetupAction
                    ? t("profile.setup.nextStep", {
                        step: primarySetupAction.label.toLowerCase(),
                      })
                    : t("profile.setup.allClear")
                }
              />
            </View>
            <View style={styles.mobileSectionsContainer}>
              <ProfileSectionHeader
                label={t("profile.sections.professional")}
                icon="person.crop.circle.fill"
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.publicProfile")}
                  subtitle={publicProfileSummary}
                  icon="person.crop.circle.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.sports.title")}
                  subtitle={sportsSummary}
                  icon="gym.bag.fill"
                  onPress={() => router.push(INSTRUCTOR_SPORTS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.location.title")}
                  subtitle={locationSummary}
                  icon="mappin.and.ellipse"
                  onPress={() => router.push(INSTRUCTOR_LOCATION_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.account.title")}
                icon="person.crop.circle.fill"
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.nameLabel")}
                  value={currentUser?.fullName ?? nameValue}
                  icon="person.crop.circle.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.emailLabel")}
                  value={emailValue}
                  icon="paperplane.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.roleLabel")}
                  value={roleValue}
                  icon="checkmark.circle.fill"
                  palette={palette}
                  showDivider
                />
                {memberSince ? (
                  <ProfileSettingRow
                    title={t("profile.account.memberSince")}
                    value={memberSince}
                    icon="calendar.circle.fill"
                    palette={palette}
                    showDivider
                  />
                ) : null}
                <ProfileSettingRow
                  title={t("profile.language.title")}
                  value={language === "en" ? t("language.english") : t("language.hebrew")}
                  icon="globe"
                  onPress={() => void setLanguage(language === "en" ? "he" : "en")}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.appearance.systemTheme.title")}
                  icon="slider.horizontal.3"
                  palette={palette}
                  showDivider
                  accessory={
                    <KitSwitch
                      value={preference === "system"}
                      onValueChange={(value) => setPreference(value ? "system" : "light")}
                    />
                  }
                />
                <ProfileSettingRow
                  title={t("profile.appearance.darkMode.title")}
                  icon="moon.fill"
                  palette={palette}
                  accessory={
                    <KitSwitch
                      disabled={preference === "system"}
                      value={preference === "dark"}
                      onValueChange={(value) => setPreference(value ? "dark" : "light")}
                    />
                  }
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.sections.operations")}
                icon="slider.horizontal.3"
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.navigation.identityVerification")}
                  subtitle={identityVerificationSummary}
                  icon="checkmark.circle.fill"
                  onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.badge.clock"
                  onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts")}
                  subtitle={
                    bankConnected
                      ? t("profile.settings.payoutsConnected")
                      : t("profile.settings.payoutsNeeded")
                  }
                  icon="creditcard.fill"
                  onPress={() => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("auth.signOutButton")}
                  subtitle={t("profile.settings.signOutDesc")}
                  icon="arrow.right.square"
                  onPress={() => void signOut()}
                  palette={palette}
                  tone="danger"
                />
              </ProfileSectionCard>
            </View>
          </View>
        </TabScreenScrollView>
      )}
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  desktopShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
  },
  desktopRail: {
    width: 360,
  },
  desktopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
  },
  desktopMainColumn: {
    flex: 1,
    minWidth: 0,
  },
  desktopSideColumn: {
    width: 340,
  },
  desktopCardGroup: {
    marginHorizontal: 0,
  },
  mobileContentPadding: {
    paddingHorizontal: 24,
  },
  mobileSectionsContainer: {
    marginHorizontal: -24,
  },
});
