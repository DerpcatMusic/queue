import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import {
  createContentDrivenTopSheetConfig,
  getMainTabSheetBackgroundColor,
} from "@/components/layout/top-sheet-registry";
import { ProfileAccountSwitcherSheet } from "@/components/profile/profile-account-switcher-sheet";
import { LanguagePickerSheet } from "@/components/sheets/profile/language-picker-sheet";
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
import { BrandSpacing } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useSheetContext } from "@/contexts/sheet-context";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";

import { useAppLanguage } from "@/hooks/use-app-language";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";
import {
  forgetRememberedDeviceAccount,
  listRememberedDeviceAccounts,
  type RememberedDeviceAccount,
  switchToRememberedDeviceAccount,
  toDeviceAccountIdentity,
  validateSessionAfterSwitch,
} from "@/modules/session/device-account-store";
import { Box } from "@/primitives";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

function getSportsSummary(sports: string[], t: TFunction) {
  if (sports.length === 0) {
    return t("profile.settings.sports.none");
  }
  if (sports.length <= 2) {
    return sports.map((sport) => toSportLabelI18n(sport, t)).join(", ");
  }
  return t("profile.settings.sports.selected", { count: sports.length });
}

export default function InstructorProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { reloadAuthSession } = useAuthSession();
  const { language } = useAppLanguage();
  const { preference, setPreference } = useThemePreference();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedDeviceAccount[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);

  // Sheet context for opening BottomSheets instead of routes
  const { openInstructorSheet } = useSheetContext();

  // Sheet openers - using BottomSheets instead of routes
  const handleOpenPayments = useCallback(() => {
    openInstructorSheet("payments");
  }, [openInstructorSheet]);

  const handleOpenSports = useCallback(() => {
    openInstructorSheet("sports");
  }, [openInstructorSheet]);

  const handleOpenLocation = useCallback(() => {
    openInstructorSheet("location");
  }, [openInstructorSheet]);

  const handleOpenCompliance = useCallback(() => {
    openInstructorSheet("compliance");
  }, [openInstructorSheet]);

  const handleOpenCalendarSettings = useCallback(() => {
    openInstructorSheet("calendar-settings");
  }, [openInstructorSheet]);

  const handleOpenEdit = useCallback(() => {
    openInstructorSheet("edit");
  }, [openInstructorSheet]);

  const handleOpenNotifications = useCallback(() => {
    openInstructorSheet("notifications");
  }, [openInstructorSheet]);

  const handleOpenAddAccount = useCallback(() => {
    openInstructorSheet("add-account");
  }, [openInstructorSheet]);

  useEffect(() => {
    if (edit === "1") {
      handleOpenEdit();
    }
  }, [edit, handleOpenEdit]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "instructor";

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const payoutSummary = useQuery(
    api.paymentsV2.getMyPayoutSummaryV2,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const instructorAccessSnapshot = useQuery(
    api.access.getMyInstructorAccessSnapshot,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const diditVerification = instructorAccessSnapshot?.verification;
  const complianceSummary = instructorAccessSnapshot?.compliance.summary;

  const handleRequestEdit = useCallback(() => {
    handleOpenEdit();
  }, [handleOpenEdit]);

  const handleOpenAccountSwitcher = useCallback(() => {
    void listRememberedDeviceAccounts().then((accounts) => {
      setRememberedAccounts(accounts);
      setAccountSwitcherVisible(true);
    });
  }, []);
  const handleSignOut = useCallback(() => {
    setAccountSwitcherVisible(false);
    void (async () => {
      if (currentUser?._id) {
        await forgetRememberedDeviceAccount(String(currentUser._id));
      }
      await signOut();
    })();
  }, [currentUser?._id, signOut]);
  const handleUseAnotherAccount = useCallback(() => {
    setAccountSwitcherVisible(false);
    handleOpenAddAccount();
  }, [handleOpenAddAccount]);
  const handleSelectRememberedAccount = useCallback(
    (accountId: string) => {
      setAccountSwitcherVisible(false);
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
  const notificationsSummary = instructorSettings?.notificationsEnabled
    ? t("profile.notifications.summaryOn", {
        minutes: instructorSettings.lessonReminderMinutesBefore,
      })
    : t("profile.notifications.summaryOff");
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
          onPress: () => handleOpenCompliance(),
          icon: "checkmark.circle.fill" as const,
        }
      : null,
    !bankConnected
      ? {
          label: t("profile.setup.connectPayouts"),
          onPress: () => handleOpenPayments(),
          icon: "sparkles" as const,
        }
      : null,
    sportsCount === 0
      ? {
          label: t("profile.setup.chooseSports"),
          onPress: () => handleOpenSports(),
          icon: "sparkles" as const,
        }
      : null,
    !provider || provider === "none"
      ? {
          label: t("profile.setup.linkCalendar"),
          onPress: () => handleOpenCalendarSettings(),
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
      <Box>
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
      </Box>
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

  const profileSheetConfig = useMemo(() => {
    const sheetBackgroundColor = getMainTabSheetBackgroundColor(theme);
    return createContentDrivenTopSheetConfig({
      collapsedContent: profileSheetContent,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      backgroundColor: sheetBackgroundColor,
      topInsetColor: sheetBackgroundColor,
    });
  }, [profileSheetContent, theme]);

  const descriptorBody = (
    <>
      {isDesktopWeb ? (
        <TabScreenRoot
          mode="static"
          topInsetTone="sheet"
          style={[styles.screen, { backgroundColor: theme.color.appBg }]}
        >
          <Box style={styles.desktopShell}>
            <Box style={styles.desktopRail}>
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
            </Box>

            <Box style={styles.desktopContent}>
              <Box style={styles.desktopMainColumn}>
                <ProfileSectionHeader
                  label={t("profile.sections.professional")}
                  icon="person.crop.circle.fill"
                  tone="account"
                  flush
                />
                <ProfileSectionCard style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.settings.publicProfile")}
                    subtitle={publicProfileSummary}
                    icon="person.crop.circle.fill"
                    sectionTone="account"
                    onPress={handleRequestEdit}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.sports.title")}
                    subtitle={sportsSummary}
                    icon="gym.bag.fill"
                    sectionTone="account"
                    onPress={() => handleOpenSports()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.location.title")}
                    subtitle={locationSummary}
                    icon="mappin.and.ellipse"
                    sectionTone="account"
                    onPress={() => handleOpenLocation()}
                    showDivider
                  />
                </ProfileSectionCard>
              </Box>

              <Box style={styles.desktopSideColumn}>
                <ProfileSectionHeader
                  label={t("profile.account.title")}
                  icon="person.crop.circle.fill"
                  tone="account"
                  flush
                />
                <ProfileSectionCard style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.switcher.openAction")}
                    subtitle={t("profile.switcher.accountRowHint")}
                    icon="person.2.fill"
                    sectionTone="account"
                    onPress={handleOpenAccountSwitcher}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.account.nameLabel")}
                    value={currentUser?.fullName ?? nameValue}
                    icon="person.crop.circle.fill"
                    sectionTone="account"
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.account.emailLabel")}
                    value={emailValue}
                    icon="paperplane.fill"
                    sectionTone="account"
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.account.roleLabel")}
                    value={roleValue}
                    icon="checkmark.circle.fill"
                    sectionTone="account"
                    showDivider
                  />
                  {memberSince ? (
                    <ProfileSettingRow
                      title={t("profile.account.memberSince")}
                      value={memberSince}
                      icon="calendar.circle.fill"
                      sectionTone="account"
                      showDivider
                    />
                  ) : null}
                  <ProfileSettingRow
                    title={t("profile.navigation.notifications")}
                    subtitle={notificationsSummary}
                    icon="bell.fill"
                    sectionTone="preferences"
                    onPress={() => handleOpenNotifications()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.language.title")}
                    value={t(`language.${language}`)}
                    icon="globe"
                    sectionTone="preferences"
                    onPress={() => setLanguagePickerVisible(true)}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.appearance.systemTheme.title")}
                    icon="slider.horizontal.3"
                    sectionTone="preferences"
                    showDivider
                    accessory={
                      <KitSwitch
                        accessibilityLabel={t("profile.appearance.systemTheme.title")}
                        accessibilityHint="Toggles automatic theme based on system settings"
                        value={preference === "system"}
                        onValueChange={(value) => setPreference(value ? "system" : "light")}
                      />
                    }
                  />
                  <ProfileSettingRow
                    title={t("profile.appearance.darkMode.title")}
                    icon="moon.fill"
                    sectionTone="preferences"
                    accessory={
                      <KitSwitch
                        accessibilityLabel={t("profile.appearance.darkMode.title")}
                        accessibilityHint="Toggles dark mode appearance"
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
                  tone="operations"
                  flush
                />
                <ProfileSectionCard style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.navigation.compliance")}
                    subtitle={complianceNavigationSummary}
                    icon="checkmark.shield.fill"
                    sectionTone="identity"
                    onPress={() => handleOpenCompliance()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.calendar.title")}
                    subtitle={calendarSummary}
                    icon="calendar.badge.clock"
                    sectionTone="operations"
                    onPress={() => handleOpenCalendarSettings()}
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
                    sectionTone="operations"
                    onPress={() => handleOpenPayments()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    icon="arrow.right.square"
                    onPress={handleSignOut}
                    tone="danger"
                  />
                </ProfileSectionCard>
              </Box>
            </Box>
          </Box>
        </TabScreenRoot>
      ) : (
        <ProfileIndexScrollView
          routeKey="instructor/profile"
          style={styles.screen}
          contentContainerStyle={{
            gap: BrandSpacing.xl,
          }}
          bottomSpacing={BrandSpacing.xl}
        >
          <Box style={styles.mobileContentPadding}>
            {/* Account Section */}
            <ProfileSectionHeader
              label={t("profile.sections.account")}
              icon="person.crop.circle.fill"
              tone="account"
            />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.switcher.openAction")}
                subtitle={t("profile.switcher.accountRowHint")}
                icon="person.2.fill"
                sectionTone="account"
                onPress={handleOpenAccountSwitcher}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.publicProfile")}
                subtitle={publicProfileSummary}
                icon="person.crop.circle.fill"
                sectionTone="account"
                onPress={handleRequestEdit}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.sports.title")}
                subtitle={sportsSummary}
                icon="gym.bag.fill"
                sectionTone="account"
                onPress={() => handleOpenSports()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.location.title")}
                subtitle={locationSummary}
                icon="mappin.and.ellipse"
                sectionTone="account"
                onPress={() => handleOpenLocation()}
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
                sectionTone="operations"
                onPress={() => handleOpenPayments()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.navigation.compliance")}
                subtitle={complianceNavigationSummary}
                icon="checkmark.shield.fill"
                sectionTone="identity"
                onPress={() => handleOpenCompliance()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.calendar.title")}
                subtitle={calendarSummary}
                icon="calendar.badge.clock"
                sectionTone="operations"
                onPress={() => handleOpenCalendarSettings()}
              />
            </ProfileSectionCard>

            {/* Preferences Section */}
            <ProfileSectionHeader
              label={t("profile.sections.preferences")}
              icon="slider.horizontal.3"
              tone="preferences"
            />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.navigation.notifications")}
                subtitle={notificationsSummary}
                icon="bell.fill"
                sectionTone="preferences"
                onPress={() => handleOpenNotifications()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.appearance.darkMode.title")}
                icon="moon.fill"
                sectionTone="preferences"
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
                sectionTone="preferences"
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
                value={t(`language.${language}`)}
                icon="globe"
                sectionTone="preferences"
                onPress={() => setLanguagePickerVisible(true)}
              />
            </ProfileSectionCard>

            {/* Support Section */}
            <ProfileSectionHeader
              label={t("profile.sections.support")}
              icon="help"
              tone="support"
            />
            <Box style={{ paddingHorizontal: BrandSpacing.inset }}>
              <Box style={{ flexDirection: "row", gap: BrandSpacing.md }}>
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
              </Box>
              <Box style={{ marginTop: BrandSpacing.md }}>
                <ProfileSignOutButton title={t("auth.signOutButton")} onPress={handleSignOut} />
              </Box>
            </Box>
          </Box>
        </ProfileIndexScrollView>
      )}
      <ProfileAccountSwitcherSheet
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
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
      <LanguagePickerSheet
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
      />
    </>
  );

  const descriptor = useMemo(
    () => ({
      tabId: "profile" as const,
      body: descriptorBody,
      sheetConfig: profileSheetConfig,
      insetTone: "sheet" as const,
      isLoading: currentUser?.role === "instructor" && instructorSettings === undefined,
    }),
    [descriptorBody, profileSheetConfig, currentUser?.role, instructorSettings],
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
