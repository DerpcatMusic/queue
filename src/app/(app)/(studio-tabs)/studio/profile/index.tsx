import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { getTopSheetAvailableHeight } from "@/components/layout/top-sheet.helpers";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import { useMeasuredContentHeight } from "@/components/layout/use-measured-content-height";
import { ProfileRoleSwitcherCard } from "@/components/profile/profile-role-switcher-card";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ProfileIndexScrollView } from "@/components/profile/profile-subpage-sheet";
import { ProfileDesktopHeroPanel, ProfileHeaderSheet } from "@/components/profile/profile-tab";
import { ThemedText } from "@/components/themed-text";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { EXPIRY_OVERRIDE_PRESETS } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;
const STUDIO_PROFILE_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile);
const STUDIO_BRANCHES_ROUTE = `${STUDIO_PROFILE_ROUTE}/branches` as const;
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
  const { currentUser, availableRoles } = useUser();
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
  const [pendingProfileRole, setPendingProfileRole] = useState<"instructor" | "studio" | null>(
    null,
  );
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
  const switchActiveRole = useMutation(api.users.switchActiveRole);
  const [autoAcceptDefault, setAutoAcceptDefault] = useState(false);
  const [isSavingAutoAcceptDefault, setIsSavingAutoAcceptDefault] = useState(false);
  const [autoExpireMinutesBefore, setAutoExpireMinutesBefore] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (studioSettings) {
      setAutoAcceptDefault(studioSettings.autoAcceptDefault ?? false);
    }
  }, [studioSettings]);

  useEffect(() => {
    if (studioSettings) {
      setAutoExpireMinutesBefore(studioSettings.autoExpireMinutesBefore);
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
          autoExpireMinutesBefore: autoExpireMinutesBefore,
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
    [autoAcceptDefault, autoExpireMinutesBefore, studioSettings, updateMyStudioSettings],
  );

  const handleAutoExpireMinutesBeforeChange = useCallback(
    (minutes: number | undefined) => {
      if (!studioSettings) {
        return;
      }
      const previousValue = autoExpireMinutesBefore;
      setAutoExpireMinutesBefore(minutes);
      void updateMyStudioSettings({
        studioName: studioSettings.studioName ?? "",
        address: studioSettings.address ?? "",
        zone: studioSettings.zone ?? "",
        ...omitUndefined({
          autoAcceptDefault: studioSettings.autoAcceptDefault,
          autoExpireMinutesBefore: minutes,
          sports: studioSettings.sports,
          contactPhone: studioSettings.contactPhone,
          latitude: studioSettings.latitude,
          longitude: studioSettings.longitude,
        }),
      }).catch(() => {
        setAutoExpireMinutesBefore(previousValue);
      });
    },
    [autoExpireMinutesBefore, studioSettings, updateMyStudioSettings],
  );

  const handleRequestEdit = useCallback(() => {
    router.push(STUDIO_EDIT_ROUTE as Href);
  }, [router]);

  const handleSwitchProfile = useCallback(
    async (role: "instructor" | "studio") => {
      if (pendingProfileRole || currentUser?.role === role) {
        return;
      }

      setPendingProfileRole(role);
      try {
        await switchActiveRole({ role });
        router.replace(buildRoleTabRoute(role, ROLE_TAB_ROUTE_NAMES.profile) as Href);
      } finally {
        setPendingProfileRole(null);
      }
    },
    [currentUser?.role, pendingProfileRole, router, switchActiveRole],
  );
  const handleSetupRole = useCallback(
    (role: "instructor" | "studio") => {
      router.push(`/onboarding?role=${role}` as Href);
    },
    [router],
  );
  const missingRole = availableRoles.includes("instructor") ? null : "instructor";

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
  const branchSummary = studioSettings?.entitlement?.branchesFeatureEnabled
    ? t("profile.settings.branches.summary", {
        primary: studioSettings?.primaryBranch?.name ?? t("profile.settings.branches.none"),
        active: studioSettings?.entitlement?.activeBranchCount ?? 0,
        max: studioSettings?.entitlement?.maxBranches ?? 1,
      })
    : t("profile.settings.branches.singleBranchSummary", {
        primary:
          studioSettings?.primaryBranch?.name ??
          studioSettings?.studioName ??
          t("profile.settings.branches.none"),
      });
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
  const { measuredHeight: profileMeasuredHeight, onLayout: onProfileHeaderLayout } =
    useMeasuredContentHeight();
  const profileHeaderHeight = useMemo(
    () => safeTop + (profileMeasuredHeight > 0 ? profileMeasuredHeight : 128),
    [profileMeasuredHeight, safeTop],
  );
  const profileSheetStep = useMemo(() => {
    const availableHeight = Math.max(1, getTopSheetAvailableHeight(screenHeight, safeTop, 0));
    return Math.max(0.12, Math.min(0.34, profileHeaderHeight / availableHeight));
  }, [profileHeaderHeight, safeTop, screenHeight]);
  const profileSheetContent = useMemo(
    () => (
      <View onLayout={onProfileHeaderLayout}>
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
      </View>
    ),
    [
      currentUser?.image,
      handleRequestEdit,
      onProfileHeaderLayout,
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
      render: () => ({
        children: profileSheetContent,
      }),
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

  useGlobalTopSheet(
    "profile",
    !isDesktopWeb && isProfileIndexRoute ? profileSheetConfig : null,
    "profile:index:studio",
  );

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
                  title={t("profile.settings.branches.title")}
                  subtitle={branchSummary}
                  icon="square.stack.3d.up.fill"
                  onPress={() => router.push(STUDIO_BRANCHES_ROUTE as Href)}
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
                label={t("profile.sections.profiles")}
                description={t("profile.sections.profilesDesc")}
                icon="person.2.fill"
                palette={palette}
                flush
              />
              <ProfileRoleSwitcherCard
                activeRole="studio"
                availableRoles={availableRoles}
                isSwitching={pendingProfileRole !== null}
                pendingRole={pendingProfileRole}
                onSwitchRole={handleSwitchProfile}
                palette={palette}
              />
              {missingRole ? (
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.switcher.setupInstructorTitle")}
                    subtitle={t("profile.switcher.setupInstructorHint")}
                    icon="plus.circle.fill"
                    onPress={() => handleSetupRole(missingRole)}
                    palette={palette}
                  />
                </ProfileSectionCard>
              ) : null}
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: BrandSpacing.componentPadding,
                    paddingHorizontal: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.componentPadding,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: BrandRadius.cardSubtle,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: palette.surfaceAlt as string,
                    }}
                  >
                    <IconSymbol name="clock.fill" size={18} color={palette.primary as string} />
                  </View>
                  <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: palette.text as string,
                      }}
                    >
                      {t("profile.settings.autoExpireJobs")}
                    </Text>
                    <ThemedText type="micro" style={{ color: palette.textMuted as string }}>
                      {t("profile.settings.autoExpire.description")}
                    </ThemedText>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: BrandSpacing.sm,
                        marginTop: BrandSpacing.sm,
                      }}
                    >
                      <ChoicePill
                        label={t("jobsTab.form.useStudioDefault")}
                        selected={autoExpireMinutesBefore === undefined}
                        compact
                        backgroundColor={palette.surfaceAlt as string}
                        selectedBackgroundColor={palette.primary as string}
                        labelColor={palette.text as string}
                        selectedLabelColor={palette.onPrimary as string}
                        onPress={() => handleAutoExpireMinutesBeforeChange(undefined)}
                      />
                      {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
                        <ChoicePill
                          key={minutes}
                          label={t("jobsTab.form.minutes", { value: minutes })}
                          selected={autoExpireMinutesBefore === minutes}
                          compact
                          backgroundColor={palette.surfaceAlt as string}
                          selectedBackgroundColor={palette.primary as string}
                          labelColor={palette.text as string}
                          selectedLabelColor={palette.onPrimary as string}
                          onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <View
                  style={{
                    height: 1,
                    marginLeft: 56,
                    marginRight: 18,
                    backgroundColor: palette.border as string,
                  }}
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
            gap: BrandSpacing.lg + 2,
          }}
          topSpacing={BrandSpacing.lg + 2}
          bottomSpacing={BrandSpacing.xxl}
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
                title={t("profile.settings.branches.title")}
                subtitle={branchSummary}
                icon="square.stack.3d.up.fill"
                onPress={() => router.push(STUDIO_BRANCHES_ROUTE as Href)}
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
              label={t("profile.sections.profiles")}
              description={t("profile.sections.profilesDesc")}
              icon="person.2.fill"
              palette={palette}
            />
            <ProfileRoleSwitcherCard
              activeRole="studio"
              availableRoles={availableRoles}
              isSwitching={pendingProfileRole !== null}
              pendingRole={pendingProfileRole}
              onSwitchRole={handleSwitchProfile}
              palette={palette}
            />
            {missingRole ? (
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.switcher.setupInstructorTitle")}
                  subtitle={t("profile.switcher.setupInstructorHint")}
                  icon="plus.circle.fill"
                  onPress={() => handleSetupRole(missingRole)}
                  palette={palette}
                />
              </ProfileSectionCard>
            ) : null}

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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: BrandSpacing.componentPadding,
                  paddingHorizontal: BrandSpacing.lg,
                  paddingVertical: BrandSpacing.componentPadding,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: BrandRadius.cardSubtle,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.surfaceAlt as string,
                  }}
                >
                  <IconSymbol name="clock.fill" size={18} color={palette.primary as string} />
                </View>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: palette.text as string,
                    }}
                  >
                    {t("profile.settings.autoExpireJobs")}
                  </Text>
                  <ThemedText type="micro" style={{ color: palette.textMuted as string }}>
                    {t("profile.settings.autoExpire.description")}
                  </ThemedText>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: BrandSpacing.sm,
                      marginTop: BrandSpacing.sm,
                    }}
                  >
                    <ChoicePill
                      label={t("jobsTab.form.useStudioDefault")}
                      selected={autoExpireMinutesBefore === undefined}
                      compact
                      backgroundColor={palette.surfaceAlt as string}
                      selectedBackgroundColor={palette.primary as string}
                      labelColor={palette.text as string}
                      selectedLabelColor={palette.onPrimary as string}
                      onPress={() => handleAutoExpireMinutesBeforeChange(undefined)}
                    />
                    {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
                      <ChoicePill
                        key={minutes}
                        label={t("jobsTab.form.minutes", { value: minutes })}
                        selected={autoExpireMinutesBefore === minutes}
                        compact
                        backgroundColor={palette.surfaceAlt as string}
                        selectedBackgroundColor={palette.primary as string}
                        labelColor={palette.text as string}
                        selectedLabelColor={palette.onPrimary as string}
                        onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                      />
                    ))}
                  </View>
                </View>
              </View>
              <View
                style={{
                  height: 1,
                  marginLeft: 56,
                  marginRight: 18,
                  backgroundColor: palette.border as string,
                }}
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
    gap: BrandSpacing.xl,
  },
  desktopRail: {
    width: 360,
  },
  desktopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.xl,
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
    paddingHorizontal: BrandSpacing.xl,
  },
});
