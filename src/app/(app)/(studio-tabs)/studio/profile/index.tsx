import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ProfileIndexScrollView } from "@/components/profile/profile-subpage-sheet";
import {
  getProfileHeaderExpandedHeight,
  ProfileDesktopHeroPanel,
  ProfileHeaderSheet,
} from "@/components/profile/profile-tab";
import { KitSwitch } from "@/components/ui/kit";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { omitUndefined } from "@/lib/omit-undefined";
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
  const pathname = usePathname();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { safeTop } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [hasActivated, setHasActivated] = useState(false);
  const isBodyReady = useDeferredTabMount(pathname === STUDIO_PROFILE_ROUTE, { delayMs: 36 });

  useEffect(() => {
    if (pathname === STUDIO_PROFILE_ROUTE) {
      setHasActivated(true);
    }
  }, [pathname]);

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
  const updateMyStudioSettings = useMutation(api.users.updateMyStudioSettings);
  const [autoAcceptDefault, setAutoAcceptDefault] = useState(false);
  const [isSavingAutoAcceptDefault, setIsSavingAutoAcceptDefault] = useState(false);

  useEffect(() => {
    if (studioSettings) {
      setAutoAcceptDefault(studioSettings.autoAcceptDefault ?? false);
    }
  }, [studioSettings]);

  const handleAutoAcceptDefaultChange = useCallback(
    (value: boolean) => {
      if (!studioSettings) {
        return;
      }
      const previousValue = autoAcceptDefault;
      setAutoAcceptDefault(value);
      setIsSavingAutoAcceptDefault(true);
      void updateMyStudioSettings({
        studioName: studioSettings.studioName ?? "",
        address: studioSettings.address ?? "",
        zone: studioSettings.zone ?? "",
        ...omitUndefined({
          autoAcceptDefault: value,
          autoExpireMinutesBefore: studioSettings.autoExpireMinutesBefore,
          sports: studioSettings.sports,
          contactPhone: studioSettings.contactPhone,
          latitude: studioSettings.latitude,
          longitude: studioSettings.longitude,
        }),
      })
        .catch(() => {
          setAutoAcceptDefault(previousValue);
        })
        .finally(() => {
          setIsSavingAutoAcceptDefault(false);
        });
    },
    [autoAcceptDefault, studioSettings, updateMyStudioSettings],
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
  const profileStatus = setupActions.length === 0 ? "ready" : "pending";
  const publicProfileSummary =
    studioSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", { count: socialCount })
      : t("profile.settings.publicProfilePrompt"));
  const profileHeaderHeight = useMemo(() => getProfileHeaderExpandedHeight(safeTop), [safeTop]);
  const profileSheetStep = useMemo(() => {
    const availableHeight = Math.max(1, screenHeight - safeTop - 80);
    return Math.max(0.12, Math.min(0.34, profileHeaderHeight / availableHeight));
  }, [profileHeaderHeight, safeTop, screenHeight]);
  const profileSheetContent = useMemo(
    () => (
      <ProfileHeaderSheet
        profileName={profileName}
        roleLabel={t("profile.hero.studioProfile")}
        profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
        palette={palette}
        onRequestEdit={handleRequestEdit}
        primaryActionLabel={t("profile.actions.edit")}
        status={profileStatus}
        bio={studioSettings?.bio}
        socialLinks={studioSettings?.socialLinks}
        sports={studioSettings?.sports ?? []}
      />
    ),
    [
      currentUser?.image,
      handleRequestEdit,
      palette,
      profileName,
      profileStatus,
      studioSettings?.bio,
      studioSettings?.profileImageUrl,
      studioSettings?.socialLinks,
      studioSettings?.sports,
      t,
    ],
  );

  const profileSheetConfig = useMemo(
    () => ({
      content: profileSheetContent,
      steps: [profileSheetStep],
      initialStep: 0,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    }),
    [palette, profileSheetContent, profileSheetStep],
  );

  const isProfileIndexRoute = pathname === STUDIO_PROFILE_ROUTE || pathname.endsWith("/profile");

  useGlobalTopSheet("profile", !isDesktopWeb && isProfileIndexRoute ? profileSheetConfig : null);

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
              statusLabel={
                profileStatus === "ready"
                  ? t("profile.hero.statusReady")
                  : t("profile.hero.statusPending")
              }
              statusTone={profileStatus === "ready" ? "success" : "warning"}
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
            />
          </View>

          <View style={styles.desktopContent}>
            <View style={styles.desktopMainColumn}>
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
                  title={t("profile.settings.autoExpireJobs")}
                  value={t("profile.settings.autoExpire.value", {
                    minutes: studioSettings?.autoExpireMinutesBefore ?? 30,
                  })}
                  icon="clock.fill"
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.autoAcceptJobs")}
                  subtitle={t("profile.settings.autoAcceptJobsDescription")}
                  icon="checkmark.seal.fill"
                  palette={palette}
                  showDivider
                  accessory={
                    <KitSwitch
                      disabled={isSavingAutoAcceptDefault || studioSettings === undefined}
                      value={autoAcceptDefault}
                      onValueChange={handleAutoAcceptDefaultChange}
                    />
                  }
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
        <ProfileIndexScrollView
          routeKey="studio/profile"
          style={styles.screen}
          contentContainerStyle={{
            gap: 18,
          }}
          topSpacing={18}
          bottomSpacing={32}
        >
          <View style={styles.mobileContentPadding}>
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
                title={t("profile.settings.autoExpireJobs")}
                value={t("profile.settings.autoExpire.value", {
                  minutes: studioSettings?.autoExpireMinutesBefore ?? 30,
                })}
                icon="clock.fill"
                palette={palette}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.autoAcceptJobs")}
                subtitle={t("profile.settings.autoAcceptJobsDescription")}
                icon="checkmark.seal.fill"
                palette={palette}
                showDivider
                accessory={
                  <KitSwitch
                    disabled={isSavingAutoAcceptDefault || studioSettings === undefined}
                    value={autoAcceptDefault}
                    onValueChange={handleAutoAcceptDefaultChange}
                  />
                }
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
        </ProfileIndexScrollView>
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
});
