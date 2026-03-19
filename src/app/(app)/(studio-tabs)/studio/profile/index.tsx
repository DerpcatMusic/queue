import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, View } from "react-native";
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
const STUDIO_PROFILE_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile);
const STUDIO_CALENDAR_SETTINGS_ROUTE = `${STUDIO_PROFILE_ROUTE}/calendar-settings` as const;
const STUDIO_PAYMENTS_ROUTE = `${STUDIO_PROFILE_ROUTE}/payments` as const;
const STUDIO_EDIT_ROUTE = `${STUDIO_PROFILE_ROUTE}/edit` as const;

function getSportsSummary(sports: string[], t: TFunction) {
  if (sports.length === 0) {
    return t("profile.settings.sports.none");
  }
  if (sports.length <= 2) {
    return sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ");
  }
  return t("profile.settings.sports.selected", { count: sports.length });
}

export default function StudioProfileScreen() {
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
      router.replace(STUDIO_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "studio" && hasActivated && isBodyReady;

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );

  const handleRequestEdit = useCallback(() => {
    router.push(STUDIO_EDIT_ROUTE as Href);
  }, [router]);

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

  const sportsSummary = getSportsSummary(studioSettings?.sports ?? [], t);
  const provider = studioSettings?.calendarProvider;
  const calendarSummary =
    !provider || provider === "none"
      ? t("profile.settings.calendar.provider.none")
      : provider === "google"
        ? t("profile.settings.calendar.provider.google")
        : t("profile.settings.calendar.provider.apple");
  const socialCount = Object.keys(studioSettings?.socialLinks ?? {}).length;
  const sportsCount = studioSettings?.sports?.length ?? 0;
  const setupActions = [
    !studioSettings?.address
      ? {
          label: t("profile.setup.addStudioDetails"),
          onPress: handleRequestEdit,
          icon: "sparkles" as const,
        }
      : null,
    !studioSettings?.zone
      ? {
          label: t("profile.setup.setCoverageZone"),
          onPress: handleRequestEdit,
          icon: "mappin.and.ellipse" as const,
        }
      : null,
    sportsCount === 0
      ? {
          label: t("profile.setup.chooseSports"),
          onPress: handleRequestEdit,
          icon: "sparkles" as const,
        }
      : null,
    socialCount === 0
      ? {
          label: t("profile.setup.addContactLinks"),
          onPress: handleRequestEdit,
          icon: "sparkles" as const,
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      onPress: () => void;
      icon: "sparkles" | "mappin.and.ellipse";
    } => item !== null,
  );
  const setupStatusLabel =
    setupActions.length === 0
      ? t("profile.setup.statusReady")
      : t("profile.setup.statusPending", { count: setupActions.length });
  const publicProfileSummary =
    studioSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", { count: socialCount })
      : t("profile.settings.publicProfilePrompt"));
  const primarySetupAction = setupActions[0] ?? null;

  const profileSheetConfig = useMemo(
    () => ({
      render: ({ scrollY }: { scrollY: SharedValue<number> }) => (
        <ProfileHeroSheet
          profileName={profileName}
          roleLabel={t("profile.hero.studioProfile")}
          profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
          palette={palette}
          scrollY={scrollY}
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit")}
          {...(primarySetupAction ? { secondaryAction: primarySetupAction } : {})}
          statusLabel={setupStatusLabel}
          bio={studioSettings?.bio}
          socialLinks={studioSettings?.socialLinks}
          sports={studioSettings?.sports ?? []}
        />
      ),
    }),
    [
      currentUser?.image,
      handleRequestEdit,
      palette,
      primarySetupAction,
      profileName,
      setupStatusLabel,
      studioSettings?.bio,
      studioSettings?.profileImageUrl,
      studioSettings?.socialLinks,
      studioSettings?.sports,
      t,
    ],
  );

  useGlobalTopSheet("profile", isDesktopWeb ? null : profileSheetConfig);

  if (
    !hasActivated ||
    !isBodyReady ||
    (currentUser?.role === "studio" && studioSettings === undefined)
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
              profileName={profileName}
              roleLabel={t("profile.hero.studioProfile")}
              profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
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
                label={t("profile.sections.studio")}
                icon="building.2.fill"
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
                  title={t("profile.settings.studioDetails")}
                  subtitle={
                    studioSettings?.address ?? t("profile.settings.completeOnboardingAddress")
                  }
                  icon="building.2.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.coverageZone")}
                  subtitle={studioSettings?.zone ?? t("profile.settings.noZone")}
                  icon="mappin.and.ellipse"
                  onPress={handleRequestEdit}
                  palette={palette}
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
                  title={t("profile.account.nameLabel")}
                  value={currentUser?.fullName ?? profileName}
                  icon="person.crop.circle.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.emailLabel")}
                  value={emailValue}
                  icon="paperplane.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.roleLabel")}
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
                  icon="moon.fill"
                  palette={palette}
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
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.sections.operations")}
                icon="slider.horizontal.3"
                palette={palette}
                flush
              />
              <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.settings.autoExpireJobs")}
                  value={t("profile.settings.autoExpire.value", {
                    minutes: studioSettings?.autoExpireMinutesBefore ?? 30,
                  })}
                  icon="clock.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.circle.fill"
                  onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts")}
                  subtitle={t("profile.sections.paymentsDesc")}
                  icon="creditcard.fill"
                  onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
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
          routeKey="studio/profile"
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
                label={t("profile.sections.studio")}
                icon="building.2.fill"
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
                  title={t("profile.settings.studioDetails")}
                  subtitle={
                    studioSettings?.address ?? t("profile.settings.completeOnboardingAddress")
                  }
                  icon="building.2.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.coverageZone")}
                  subtitle={studioSettings?.zone ?? t("profile.settings.noZone")}
                  icon="mappin.and.ellipse"
                  onPress={handleRequestEdit}
                  palette={palette}
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.account.title")}
                icon="person.crop.circle.fill"
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.account.nameLabel")}
                  value={currentUser?.fullName ?? profileName}
                  icon="person.crop.circle.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.emailLabel")}
                  value={emailValue}
                  icon="paperplane.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.roleLabel")}
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
                  icon="moon.fill"
                  palette={palette}
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
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.sections.operations")}
                icon="slider.horizontal.3"
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.autoExpireJobs")}
                  value={t("profile.settings.autoExpire.value", {
                    minutes: studioSettings?.autoExpireMinutesBefore ?? 30,
                  })}
                  icon="clock.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.circle.fill"
                  onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts")}
                  subtitle={t("profile.sections.paymentsDesc")}
                  icon="creditcard.fill"
                  onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
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
