import { useAuthActions } from "@convex-dev/auth/react";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, View } from "react-native";

import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { createContentDrivenTopSheetConfig } from "@/components/layout/top-sheet-registry";
import { ProfileAccountSwitcherSheet } from "@/components/profile/profile-account-switcher-sheet";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
  ProfileSignOutButton,
  ProfileSupportCard,
} from "@/components/profile/profile-settings-sections";
import { ProfileIndexScrollView } from "@/components/profile/profile-subpage-sheet";
import { ProfileDesktopHeroPanel, ProfileHeaderSheet } from "@/components/profile/profile-tab";
import { KitSwitch } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";
import {
  forgetRememberedDeviceAccount,
  listRememberedDeviceAccounts,
  type RememberedDeviceAccount,
  switchToRememberedDeviceAccount,
  toDeviceAccountIdentity,
  validateSessionAfterSwitch,
} from "@/modules/session/device-account-store";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;
const INSTRUCTOR_PROFILE_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile);
const INSTRUCTOR_COMPLIANCE_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/compliance` as const;
const INSTRUCTOR_SPORTS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/sports` as const;
const INSTRUCTOR_LOCATION_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/location` as const;
const INSTRUCTOR_CALENDAR_SETTINGS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/calendar-settings` as const;
const INSTRUCTOR_PAYMENTS_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/payments` as const;
const INSTRUCTOR_ADD_ACCOUNT_ROUTE = `${INSTRUCTOR_PROFILE_ROUTE}/add-account` as const;
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

export default function InstructorProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { reloadAuthSession } = useAuthSession();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference } = useThemePreference();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const { isDesktopWeb } = useLayoutBreakpoint();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const accountSwitcherSheetRef = useRef<BottomSheet>(null);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedDeviceAccount[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (edit === "1") {
      router.replace(INSTRUCTOR_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "instructor";

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
  const complianceSummary = useQuery(
    api.compliance.getMyInstructorComplianceSummary,
    shouldLoadSettings ? emptyArgs : "skip",
  );

  const handleRequestEdit = useCallback(() => {
    router.push(INSTRUCTOR_EDIT_ROUTE as Href);
  }, [router]);

  const handleOpenAccountSwitcher = useCallback(() => {
    void listRememberedDeviceAccounts().then((accounts) => {
      setRememberedAccounts(accounts);
      accountSwitcherSheetRef.current?.snapToIndex(0);
    });
  }, []);
  const handleSignOut = useCallback(() => {
    accountSwitcherSheetRef.current?.close();
    void (async () => {
      if (currentUser?._id) {
        await forgetRememberedDeviceAccount(String(currentUser._id));
      }
      await signOut();
    })();
  }, [currentUser?._id, signOut]);
  const handleUseAnotherAccount = useCallback(() => {
    accountSwitcherSheetRef.current?.close();
    router.push(INSTRUCTOR_ADD_ACCOUNT_ROUTE as Href);
  }, [router]);
  const handleSelectRememberedAccount = useCallback(
    (accountId: string) => {
      accountSwitcherSheetRef.current?.close();
      setSwitchingAccountId(accountId);
      void (async () => {
        try {
          await switchToRememberedDeviceAccount({
            accountId,
            ...(currentUser ? { currentAccount: toDeviceAccountIdentity(currentUser) } : {}),
          });
          reloadAuthSession();

          // Validate that the new session actually works by checking if currentUser loads.
          // This prevents the race where isAuthenticated=true but currentUser=null,
          // which would cause sessionGate to redirect to sign-in unnecessarily.
          const sessionValid = await validateSessionAfterSwitch(() => currentUser);

          if (!sessionValid) {
            // Stored session is invalid - backend rejected it
            // Throw to trigger error handling, user stays on this profile
            throw new Error("Stored session is no longer valid. Please sign in again.");
          }
        } catch (_error) {
          setSwitchingAccountId(null);
          // Error is already logged by the catch - user stays on profile screen
        }
      })();
    },
    [currentUser, reloadAuthSession],
  );
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
  const complianceNavigationSummary = complianceSummary
    ? complianceSummary.canApplyToJobs
      ? t("profile.compliance.navigation.ready")
      : t("profile.compliance.navigation.blocked")
    : t("common.loading");
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
          onPress: () => router.push(INSTRUCTOR_COMPLIANCE_ROUTE as Href),
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
  const profileStatus =
    setupActions.length === 0 ? "ready" : identityVerified ? "pending" : "unverified";

  const publicProfileSummary =
    instructorSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", { count: socialCount })
      : t("profile.settings.publicProfilePrompt"));
  const profileSheetContent = useMemo(
    () => (
      <View>
        <ProfileHeaderSheet
          profileName={nameValue}
          roleLabel={
            identityVerified
              ? t("profile.hero.verifiedInstructor")
              : t("profile.hero.instructorProfile")
          }
          profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit")}
          status={profileStatus}
          bio={instructorSettings?.bio}
          socialLinks={instructorSettings?.socialLinks}
          sports={instructorSettings?.sports ?? []}
          memberSince={memberSince ?? undefined}
          isVerified={identityVerified}
        />
      </View>
    ),
    [
      currentUser?.image,
      handleRequestEdit,
      identityVerified,
      instructorSettings?.bio,
      instructorSettings?.profileImageUrl,
      instructorSettings?.socialLinks,
      instructorSettings?.sports,
      nameValue,
      memberSince,
      profileStatus,
      t,
    ],
  );

  const profileSheetConfig = useMemo(
    () =>
      createContentDrivenTopSheetConfig({
        render: () => ({
          children: profileSheetContent,
        }),
        padding: {
          vertical: 0,
          horizontal: 0,
        },
        backgroundColor: theme.color.tertiary,
        topInsetColor: theme.color.tertiary,
      }),
    [profileSheetContent, theme.color.tertiary],
  );

  const descriptorBody = (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={styles.screen}>
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
              summary={publicProfileSummary}
              statusLabel={
                profileStatus === "ready"
                  ? t("profile.hero.statusReady")
                  : profileStatus === "pending"
                    ? t("profile.hero.statusPending")
                    : t("profile.hero.statusUnverified")
              }
              statusTone={
                profileStatus === "ready"
                  ? "success"
                  : profileStatus === "pending"
                    ? "warning"
                    : "neutral"
              }
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
              isVerified={identityVerified}
              onOpenSwitcher={handleOpenAccountSwitcher}
              switcherActionLabel={t("profile.switcher.openAction")}
            />
          </View>

          <View style={styles.desktopContent}>
            <View style={styles.desktopMainColumn}>
              <ProfileSectionHeader
                label={t("profile.sections.professional")}
                icon="person.crop.circle.fill"
                flush
              />
              <ProfileSectionCard style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.settings.publicProfile")}
                  subtitle={publicProfileSummary}
                  icon="person.crop.circle.fill"
                  onPress={handleRequestEdit}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.sports.title")}
                  subtitle={sportsSummary}
                  icon="gym.bag.fill"
                  onPress={() => router.push(INSTRUCTOR_SPORTS_ROUTE as Href)}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.location.title")}
                  subtitle={locationSummary}
                  icon="mappin.and.ellipse"
                  onPress={() => router.push(INSTRUCTOR_LOCATION_ROUTE as Href)}
                  showDivider
                />
              </ProfileSectionCard>
            </View>

            <View style={styles.desktopSideColumn}>
              <ProfileSectionHeader
                label={t("profile.account.title")}
                icon="person.crop.circle.fill"
                flush
              />
              <ProfileSectionCard style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.switcher.openAction")}
                  subtitle={t("profile.switcher.accountRowHint")}
                  icon="person.2.fill"
                  onPress={handleOpenAccountSwitcher}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.nameLabel")}
                  value={currentUser?.fullName ?? nameValue}
                  icon="person.crop.circle.fill"
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.emailLabel")}
                  value={emailValue}
                  icon="paperplane.fill"
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.account.roleLabel")}
                  value={roleValue}
                  icon="checkmark.circle.fill"
                  showDivider
                />
                {memberSince ? (
                  <ProfileSettingRow
                    title={t("profile.account.memberSince")}
                    value={memberSince}
                    icon="calendar.circle.fill"
                    showDivider
                  />
                ) : null}
                <ProfileSettingRow
                  title={t("profile.language.title")}
                  value={language === "en" ? t("language.english") : t("language.hebrew")}
                  icon="globe"
                  onPress={() => void setLanguage(language === "en" ? "he" : "en")}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.appearance.systemTheme.title")}
                  icon="slider.horizontal.3"
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
                flush
              />
              <ProfileSectionCard style={styles.desktopCardGroup}>
                <ProfileSettingRow
                  title={t("profile.navigation.compliance")}
                  subtitle={complianceNavigationSummary}
                  icon="checkmark.shield.fill"
                  onPress={() => router.push(INSTRUCTOR_COMPLIANCE_ROUTE as Href)}
                  tone="accent"
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.badge.clock"
                  onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
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
                  tone="accent"
                  accentColor={theme.color.success}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("auth.signOutButton")}
                  icon="arrow.right.square"
                  onPress={handleSignOut}
                  tone="danger"
                />
              </ProfileSectionCard>
            </View>
          </View>
        </View>
      ) : (
        <ProfileIndexScrollView
          routeKey="instructor/profile"
          style={styles.screen}
          contentContainerStyle={{
            gap: BrandSpacing.xl,
          }}
          topSpacing={BrandSpacing.md}
          bottomSpacing={BrandSpacing.xl}
        >
          <View style={styles.mobileContentPadding}>
            {/* Account Section */}
            <ProfileSectionHeader
              label={t("profile.sections.account")}
              icon="person.crop.circle.fill"
            />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.switcher.openAction")}
                subtitle={t("profile.switcher.accountRowHint")}
                icon="person.2.fill"
                onPress={handleOpenAccountSwitcher}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.publicProfile")}
                subtitle={publicProfileSummary}
                icon="person.crop.circle.fill"
                onPress={handleRequestEdit}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.sports.title")}
                subtitle={sportsSummary}
                icon="gym.bag.fill"
                onPress={() => router.push(INSTRUCTOR_SPORTS_ROUTE as Href)}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.location.title")}
                subtitle={locationSummary}
                icon="mappin.and.ellipse"
                onPress={() => router.push(INSTRUCTOR_LOCATION_ROUTE as Href)}
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
                tone="accent"
                accentColor={theme.color.success}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.navigation.compliance")}
                subtitle={complianceNavigationSummary}
                icon="checkmark.shield.fill"
                onPress={() => router.push(INSTRUCTOR_COMPLIANCE_ROUTE as Href)}
                tone="accent"
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.calendar.title")}
                subtitle={calendarSummary}
                icon="calendar.badge.clock"
                onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
                showDivider
              />
            </ProfileSectionCard>

            {/* Preferences Section */}
            <ProfileSectionHeader
              label={t("profile.sections.preferences")}
              icon="slider.horizontal.3"
            />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.appearance.notifications")}
                icon="bell.fill"
                showDivider
                accessory={
                  <View
                    style={{
                      backgroundColor: theme.color.primary,
                      paddingHorizontal: BrandSpacing.xs,
                      paddingVertical: BrandSpacing.xxs,
                      borderRadius: BrandRadius.buttonSubtle,
                    }}
                  >
                    <Text style={[BrandType.labelStrong, { color: theme.color.onPrimary }]}>
                      ON
                    </Text>
                  </View>
                }
              />
              <ProfileSettingRow
                title={t("profile.appearance.darkMode.title")}
                icon="moon.fill"
                showDivider
                accessory={
                  <KitSwitch
                    disabled={preference === "system"}
                    value={preference === "dark"}
                    onValueChange={(value) => setPreference(value ? "dark" : "light")}
                  />
                }
              />
              <ProfileSettingRow
                title={t("profile.appearance.systemTheme.title")}
                icon="slider.horizontal.3"
                showDivider
                accessory={
                  <KitSwitch
                    value={preference === "system"}
                    onValueChange={(value) => setPreference(value ? "system" : "light")}
                  />
                }
              />
              <ProfileSettingRow
                title={t("profile.language.title")}
                value={language === "en" ? t("language.english") : t("language.hebrew")}
                icon="globe"
                onPress={() => void setLanguage(language === "en" ? "he" : "en")}
              />
            </ProfileSectionCard>

            {/* Support Section */}
            <ProfileSectionHeader label={t("profile.sections.support")} icon="help" />
            <View style={{ paddingHorizontal: BrandSpacing.inset }}>
              <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
                <ProfileSupportCard
                  icon="help_center"
                  title="Help Center"
                  onPress={() => Linking.openURL("https://www.join-queue.com/he/help/")}
                />
                <ProfileSupportCard
                  icon="gavel"
                  title="Terms"
                  onPress={() => Linking.openURL("https://www.join-queue.com/he/tos/")}
                />
              </View>
              <View style={{ marginTop: BrandSpacing.md }}>
                <ProfileSignOutButton title={t("auth.signOutButton")} onPress={handleSignOut} />
              </View>
            </View>
          </View>
        </ProfileIndexScrollView>
      )}
      <ProfileAccountSwitcherSheet
        innerRef={accountSwitcherSheetRef}
        onDismissed={() => undefined}
        currentAccountId={currentUser?._id ? String(currentUser._id) : null}
        currentAccountName={nameValue}
        currentAccountEmail={currentUser?.email}
        currentRoleLabel={roleValue}
        rememberedAccounts={rememberedAccounts}
        switchingAccountId={switchingAccountId}
        onSelectRememberedAccount={handleSelectRememberedAccount}
        onSignOut={handleSignOut}
        onUseAnotherAccount={handleUseAnotherAccount}
        profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
      />
    </TabScreenRoot>
  );

  const descriptor = useMemo(
    () => ({
      tabId: "profile" as const,
      body: descriptorBody,
      sheetConfig: profileSheetConfig,
      insetTone: "sheet" as const,
      isLoading: currentUser?.role === "instructor" && instructorSettings === undefined,
    }),
    [
      descriptorBody,
      profileSheetConfig,
      currentUser?.role,
      instructorSettings,
    ],
  );

  useTabSceneDescriptor(descriptor);

  return descriptorBody;
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
    width: BrandSpacing.shellCommandPanel, // 360px — fixed width for hero rail on desktop
    flexShrink: 0,
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
    width: BrandSpacing.shellPanel + BrandSpacing.lg, // 336px — fixed width for settings column on desktop
    flexShrink: 0,
  },
  desktopCardGroup: {
    marginHorizontal: 0,
  },
  mobileContentPadding: {
    paddingHorizontal: BrandSpacing.inset,
  },
});
