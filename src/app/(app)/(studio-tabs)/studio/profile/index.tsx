import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import {
  createContentDrivenTopSheetConfig,
  getMainTabSheetBackgroundColor,
} from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { DeleteAccountButton } from "@/components/profile/delete-account-button";
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
import { LanguagePickerSheet } from "@/components/sheets/profile/language-picker-sheet";
import { ThemedText } from "@/components/themed-text";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useSheetContext } from "@/contexts/sheet-context";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";

import { useAppLanguage } from "@/hooks/use-app-language";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useLocationStorage, useStudioProfileStorage } from "@/hooks/use-onboarding-storage";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { BorderWidth } from "@/lib/design-system";
import { EXPIRY_OVERRIDE_PRESETS } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";
import {
  forgetRememberedDeviceAccount,
  listRememberedDeviceAccounts,
  type RememberedDeviceAccount,
  switchToRememberedDeviceAccount,
  toDeviceAccountIdentity,
} from "@/modules/session/device-account-store";
import { clearPendingPostSignOutAuthIntent } from "@/modules/session/post-signout-auth-intent";
import { Box } from "@/primitives";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
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

function getStudioComplianceSummaryLabel(
  summary:
    | {
        canPublishJobs: boolean;
        blockingReasons: string[];
        ownerIdentityStatus: "approved" | "pending" | "missing" | "failed";
        businessProfileStatus: "incomplete" | "complete";
        paymentStatus: "missing" | "pending" | "ready" | "failed";
      }
    | null
    | undefined,
  t: TFunction,
) {
  if (!summary) {
    return t("profile.studioCompliance.status.loading");
  }
  if (summary.canPublishJobs) {
    return t("profile.studioCompliance.status.ready", {
      defaultValue: "Ready to publish jobs",
    });
  }
  return t("profile.studioCompliance.status.pendingCount", {
    count: summary.blockingReasons.length || 1,
    defaultValue: `Publishing locked · ${summary.blockingReasons.length || 1} step(s) left`,
  });
}

export default function StudioProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser, isAuthLoading } = useUser();
  const { restartAppSession, startSessionTransition, isSessionTransitioning } = useAuthSession();
  const { language } = useAppLanguage();
  const { preference, setPreference } = useThemePreference();
  const { color } = useTheme();
  const { save: saveStudioOnboarding } = useStudioProfileStorage();
  const { save: saveOnboardingLocation } = useLocationStorage();
  const { t, i18n } = useTranslation();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedDeviceAccount[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const studioSetupTitle = t("profile.navigation.studioCompliance");

  // Sheet context for opening BottomSheets instead of routes
  const { openStudioSheet } = useSheetContext();

  // Sheet openers - using BottomSheets instead of routes
  const handleOpenCompliance = useCallback(() => {
    router.push("/onboarding/verification?role=studio");
  }, []);

  const handleOpenBranches = useCallback(() => {
    openStudioSheet("branches");
  }, [openStudioSheet]);

  const handleOpenCalendarSettings = useCallback(() => {
    openStudioSheet("calendar-settings");
  }, [openStudioSheet]);

  const handleOpenEdit = useCallback(() => {
    openStudioSheet("edit");
  }, [openStudioSheet]);

  const handleOpenBusinessDetails = useCallback(() => {
    router.push("/onboarding/verification?role=studio&focus=business");
  }, []);

  const handleOpenNotifications = useCallback(() => {
    openStudioSheet("notifications");
  }, [openStudioSheet]);

  const handleOpenAddAccount = useCallback(() => {
    openStudioSheet("add-account");
  }, [openStudioSheet]);

  useEffect(() => {
    if (edit === "1") {
      handleOpenEdit();
    }
  }, [edit, handleOpenEdit]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "studio";

  const studioSettings = useQuery(
    api.studios.settings.getMyStudioSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const studioAccessSnapshot = useQuery(
    api.access.snapshots.getMyStudioAccessSnapshot,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const studioComplianceSummary = studioAccessSnapshot?.compliance.summary;
  const studioDiditVerification = studioAccessSnapshot?.verification;
  const updateMyStudioSettings = useMutation(api.studios.settings.updateMyStudioSettings);
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
    startSessionTransition(2500);
    clearPendingPostSignOutAuthIntent();
    router.replace("/sign-in");
    void (async () => {
      if (currentUser?._id) {
        await forgetRememberedDeviceAccount(String(currentUser._id));
      }
      await signOut();
    })();
  }, [currentUser?._id, signOut, startSessionTransition]);
  const handleUseAnotherAccount = useCallback(() => {
    setAccountSwitcherVisible(false);
    handleOpenAddAccount();
  }, [handleOpenAddAccount]);
  const handleRedoOnboarding = useCallback(() => {
    saveStudioOnboarding({
      studioName: studioSettings?.studioName ?? currentUser?.fullName ?? "",
      sports: studioSettings?.sports ?? [],
    });
    saveOnboardingLocation({
      address: studioSettings?.address ?? "",
      latitude: studioSettings?.latitude ?? null,
      longitude: studioSettings?.longitude ?? null,
      country: studioSettings?.addressCountry ?? null,
      countryCode: studioSettings?.addressCountryCode ?? null,
    });
    router.push("/onboarding/studio/profile");
  }, [
    currentUser?.fullName,
    saveOnboardingLocation,
    saveStudioOnboarding,
    studioSettings?.address,
    studioSettings?.addressCountry,
    studioSettings?.addressCountryCode,
    studioSettings?.latitude,
    studioSettings?.longitude,
    studioSettings?.sports,
    studioSettings?.studioName,
  ]);
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
          restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
        } catch (_error) {
          setSwitchingAccountId(null);
          // Error is already logged by the catch - user stays on profile screen
        }
      })();
    },
    [currentUser, restartAppSession],
  );
  const roleValue = t(
    ROLE_TRANSLATION_KEYS[currentUser?.role as keyof typeof ROLE_TRANSLATION_KEYS] ??
      "profile.roles.pending",
  );
  const profileName = studioSettings?.studioName ?? currentUser?.fullName ?? roleValue;
  const emailValue = currentUser?.email ?? roleValue;
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
  const notificationsSummary = studioSettings?.notificationsEnabled
    ? t("profile.notifications.summaryOn", {
        minutes: studioSettings.lessonReminderMinutesBefore,
      })
    : t("profile.notifications.summaryOff");
  const provider = studioSettings?.calendarProvider;
  const calendarSummary =
    !provider || provider === "none"
      ? t("profile.settings.calendar.provider.none")
      : provider === "google"
        ? t("profile.settings.calendar.provider.google")
        : t("profile.settings.calendar.provider.apple");
  const studioDetailsSummary =
    studioSettings?.addressCountryCode && studioSettings?.address
      ? `${studioSettings.addressCountryCode} · ${studioSettings.address}`
      : studioSettings?.addressCountryCode
        ? `${studioSettings.addressCountryCode} business details`
        : t("profile.settings.completeOnboardingAddress");
  const socialCount = Object.keys(studioSettings?.socialLinks ?? {}).length;
  const publicProfileSummary =
    studioSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", { count: socialCount })
      : t("profile.settings.publicProfilePrompt"));
  const complianceSummaryLabel = getStudioComplianceSummaryLabel(studioComplianceSummary, t);
  const studioPublishingStatus = studioComplianceSummary?.canPublishJobs ? "ready" : "pending";
  const studioPublishingStatusTone = studioComplianceSummary?.canPublishJobs
    ? "success"
    : "warning";
  const isStudioVerified = studioDiditVerification?.isVerified ?? false;
  const profileSheetContent = useMemo(
    () => (
      <Box>
        <ProfileHeaderSheet
          profileName={profileName}
          roleLabel={t("profile.hero.studioProfile")}
          profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
          visualVariant="studioFeature"
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit")}
          status={studioPublishingStatus}
          bio={studioSettings?.bio}
          socialLinks={studioSettings?.socialLinks}
          sports={studioSettings?.sports ?? []}
          isVerified={isStudioVerified}
        />
      </Box>
    ),
    [
      currentUser?.image,
      handleRequestEdit,
      profileName,
      studioPublishingStatus,
      studioSettings?.bio,
      studioSettings?.profileImageUrl,
      studioSettings?.socialLinks,
      studioSettings?.sports,
      isStudioVerified,
      t,
    ],
  );

  const profileSheetConfig = useMemo(() => {
    const sheetBackgroundColor = getMainTabSheetBackgroundColor({ color } as never);
    return createContentDrivenTopSheetConfig({
      collapsedContent: profileSheetContent,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      disableSafeTopPadding: true,
      backgroundColor: sheetBackgroundColor,
      topInsetColor: "rgba(255, 255, 255, 0.32)",
    });
  }, [color, profileSheetContent]);

  const descriptorBody = (
    <>
      {isDesktopWeb ? (
        <TabScreenRoot
          mode="static"
          topInsetTone="sheet"
          style={[styles.screen, { backgroundColor: color.appBg }]}
        >
          <Box style={styles.desktopShell}>
            <Box style={styles.desktopRail}>
              <ProfileDesktopHeroPanel
                profileName={profileName}
                roleLabel={t("profile.hero.studioProfile")}
                profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
                summary={publicProfileSummary}
                statusLabel={complianceSummaryLabel}
                statusTone={studioPublishingStatusTone}
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
                isVerified={isStudioVerified}
                onOpenSwitcher={handleOpenAccountSwitcher}
                switcherActionLabel={t("profile.switcher.openAction")}
              />
            </Box>

            <Box style={styles.desktopContent}>
              <Box style={styles.desktopMainColumn}>
                <ProfileSectionHeader
                  label={t("profile.sections.studio")}
                  icon="building.2.fill"
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
                    title={t("profile.settings.studioDetails")}
                    subtitle={studioDetailsSummary}
                    icon="building.2.fill"
                    sectionTone="account"
                    onPress={handleOpenBusinessDetails}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.branches.title")}
                    subtitle={branchSummary}
                    icon="square.stack.3d.up.fill"
                    sectionTone="account"
                    onPress={() => handleOpenBranches()}
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
                    value={currentUser?.fullName ?? profileName}
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
                  <Box
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: BrandSpacing.sm,
                      paddingHorizontal: BrandSpacing.md,
                      paddingVertical: BrandSpacing.componentPadding,
                    }}
                  >
                    <Box style={{ width: 20, alignItems: "center", paddingTop: 2 }}>
                      <IconSymbol name="clock.fill" size={16} color={color.textMuted} />
                    </Box>
                    <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: color.text,
                        }}
                      >
                        {t("profile.settings.autoExpireJobs")}
                      </Text>
                      <ThemedText type="micro" style={{ color: color.textMuted }}>
                        {t("profile.settings.autoExpire.description")}
                      </ThemedText>
                      <Box
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: BrandSpacing.xs,
                          marginTop: BrandSpacing.xs,
                        }}
                      >
                        <ChoicePill
                          label={t("jobsTab.form.useStudioDefault")}
                          selected={autoExpireMinutesBefore === undefined}
                          compact
                          backgroundColor={color.surfaceElevated}
                          selectedBackgroundColor={color.primary}
                          labelColor={color.text}
                          selectedLabelColor={color.onPrimary}
                          onPress={() => handleAutoExpireMinutesBeforeChange(undefined)}
                        />
                        {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
                          <ChoicePill
                            key={minutes}
                            label={t("jobsTab.form.minutes", { value: minutes })}
                            selected={autoExpireMinutesBefore === minutes}
                            compact
                            backgroundColor={color.surfaceElevated}
                            selectedBackgroundColor={color.primary}
                            labelColor={color.text}
                            selectedLabelColor={color.onPrimary}
                            onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  <Box
                    style={{
                      height: BorderWidth.thin,
                      marginLeft: BrandSpacing.md + 20,
                      marginRight: BrandSpacing.md,
                      backgroundColor: color.divider,
                    }}
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.autoAcceptJobs")}
                    subtitle={t("profile.settings.autoAcceptJobsDescription")}
                    icon="checkmark.seal.fill"
                    sectionTone="operations"
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
                    title={t("profile.navigation.notifications")}
                    subtitle={notificationsSummary}
                    icon="bell.fill"
                    sectionTone="preferences"
                    onPress={() => handleOpenNotifications()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.calendar.title")}
                    subtitle={calendarSummary}
                    icon="calendar.circle.fill"
                    sectionTone="operations"
                    onPress={() => handleOpenCalendarSettings()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={studioSetupTitle}
                    subtitle={complianceSummaryLabel}
                    icon="checkmark.shield.fill"
                    sectionTone="identity"
                    onPress={() => handleOpenCompliance()}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("profile.settings.redoOnboardingTitle", {
                      defaultValue: "Redo onboarding",
                    })}
                    subtitle={t("profile.settings.redoOnboardingStudioHint", {
                      defaultValue: "Revisit studio details, location, and verification setup.",
                    })}
                    icon="arrow.clockwise"
                    sectionTone="operations"
                    onPress={handleRedoOnboarding}
                    showDivider
                  />
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle={t("profile.settings.signOutDesc")}
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
          routeKey="studio/profile"
          style={[styles.screen, { backgroundColor: color.appBg }]}
          contentContainerStyle={{
            gap: BrandSpacing.xl,
          }}
          bottomSpacing={BrandSpacing.xl}
        >
          <Box style={styles.mobileContentPadding}>
            <ProfileSectionHeader
              label={t("profile.sections.studio")}
              icon="building.2.fill"
              tone="account"
            />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.settings.publicProfile")}
                subtitle={publicProfileSummary}
                icon="person.crop.circle.fill"
                sectionTone="account"
                onPress={handleRequestEdit}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.studioDetails")}
                subtitle={studioDetailsSummary}
                icon="building.2.fill"
                sectionTone="account"
                onPress={handleOpenBusinessDetails}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.branches.title")}
                subtitle={branchSummary}
                icon="square.stack.3d.up.fill"
                sectionTone="account"
                onPress={() => handleOpenBranches()}
                showDivider
              />
            </ProfileSectionCard>

            <ProfileSectionHeader
              label={t("profile.account.title")}
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
                title={t("profile.account.nameLabel")}
                value={currentUser?.fullName ?? profileName}
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
            />
            <ProfileSectionCard>
              <Box
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: BrandSpacing.componentPadding,
                  paddingHorizontal: BrandSpacing.insetSoft,
                  paddingVertical: BrandSpacing.componentPadding,
                }}
              >
                <Box style={{ width: 20, alignItems: "center", paddingTop: 1 }}>
                  <IconSymbol name="clock.fill" size={18} color={color.secondary} />
                </Box>
                <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text
                    style={{
                      fontSize: BrandType.bodyStrong.fontSize,
                      fontWeight: "600",
                      lineHeight: 20,
                      color: color.text,
                    }}
                  >
                    {t("profile.settings.autoExpireJobs")}
                  </Text>
                  <ThemedText type="micro" style={{ color: color.textMuted }}>
                    {t("profile.settings.autoExpire.description")}
                  </ThemedText>
                  <Box
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
                      backgroundColor={color.surfaceElevated}
                      selectedBackgroundColor={color.primary}
                      labelColor={color.text}
                      selectedLabelColor={color.onPrimary}
                      onPress={() => handleAutoExpireMinutesBeforeChange(undefined)}
                    />
                    {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
                      <ChoicePill
                        key={minutes}
                        label={t("jobsTab.form.minutes", { value: minutes })}
                        selected={autoExpireMinutesBefore === minutes}
                        compact
                        backgroundColor={color.surfaceElevated}
                        selectedBackgroundColor={color.primary}
                        labelColor={color.text}
                        selectedLabelColor={color.onPrimary}
                        onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>
              <Box
                style={{
                  height: BorderWidth.thin,
                  marginLeft: BrandSpacing.insetSoft + BrandSpacing.section,
                  marginRight: BrandSpacing.insetSoft,
                  backgroundColor: color.border,
                }}
              />
              <ProfileSettingRow
                title={t("profile.settings.autoAcceptJobs")}
                subtitle={t("profile.settings.autoAcceptJobsDescription")}
                icon="checkmark.seal.fill"
                sectionTone="operations"
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
                title={t("profile.navigation.notifications")}
                subtitle={notificationsSummary}
                icon="bell.fill"
                sectionTone="preferences"
                onPress={() => handleOpenNotifications()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.calendar.title")}
                subtitle={calendarSummary}
                icon="calendar.circle.fill"
                sectionTone="operations"
                onPress={() => handleOpenCalendarSettings()}
                showDivider
              />
              <ProfileSettingRow
                title={studioSetupTitle}
                subtitle={complianceSummaryLabel}
                icon="checkmark.shield.fill"
                sectionTone="identity"
                onPress={() => handleOpenCompliance()}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.redoOnboardingTitle", {
                  defaultValue: "Redo onboarding",
                })}
                subtitle={t("profile.settings.redoOnboardingStudioHint", {
                  defaultValue: "Revisit studio details, location, and verification setup.",
                })}
                icon="arrow.clockwise"
                sectionTone="operations"
                onPress={handleRedoOnboarding}
                showDivider
              />
              <Box style={{ padding: BrandSpacing.md }}>
                <DeleteAccountButton accountRole="studio" />
              </Box>
              <Box style={{ padding: BrandSpacing.md }}>
                <ProfileSignOutButton title={t("auth.signOutButton")} onPress={handleSignOut} />
              </Box>
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
            </Box>
          </Box>
        </ProfileIndexScrollView>
      )}
      <ProfileAccountSwitcherSheet
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        currentAccountId={currentUser?._id ? String(currentUser._id) : null}
        currentAccountName={profileName}
        currentAccountEmail={currentUser?.email}
        currentRoleLabel={roleValue}
        rememberedAccounts={rememberedAccounts}
        switchingAccountId={switchingAccountId}
        onSelectRememberedAccount={handleSelectRememberedAccount}
        onSignOut={handleSignOut}
        onUseAnotherAccount={handleUseAnotherAccount}
        profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
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
      isLoading: currentUser?.role === "studio" && studioSettings === undefined,
    }),
    [descriptorBody, profileSheetConfig, currentUser?.role, studioSettings],
  );

  useTabSceneDescriptor(descriptor);

  if (
    isAuthLoading ||
    isSessionTransitioning ||
    currentUser === undefined ||
    currentUser === null
  ) {
    return (
      <LoadingScreen
        variant="launch"
        title={t("launch.title")}
        label={t("launch.loadingAccount")}
      />
    );
  }

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
    paddingHorizontal: BrandSpacing.sm,
  },
});
