import { useAuthActions } from "@convex-dev/auth/react";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
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
import { ThemedText } from "@/components/themed-text";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { BorderWidth } from "@/lib/design-system";
import { EXPIRY_OVERRIDE_PRESETS } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
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
const STUDIO_PROFILE_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile);
const STUDIO_BRANCHES_ROUTE = `${STUDIO_PROFILE_ROUTE}/branches` as const;
const STUDIO_ADD_ACCOUNT_ROUTE = `${STUDIO_PROFILE_ROUTE}/add-account` as const;
const STUDIO_CALENDAR_SETTINGS_ROUTE = `${STUDIO_PROFILE_ROUTE}/calendar-settings` as const;
const STUDIO_COMPLIANCE_ROUTE = `${STUDIO_PROFILE_ROUTE}/compliance` as const;
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

function getStudioComplianceSummaryLabel(
  summary:
    | {
        canPublishJobs: boolean;
        blockingReasons: string[];
      }
    | null
    | undefined,
  t: TFunction,
) {
  if (!summary) {
    return t("profile.studioCompliance.status.loading");
  }
  if (summary.canPublishJobs) {
    return t("profile.studioCompliance.status.ready");
  }

  const blockers = summary.blockingReasons
    .map((reason) => {
      switch (reason) {
        case "owner_identity_required":
          return t("profile.studioCompliance.blockers.identity");
        case "business_profile_required":
          return t("profile.studioCompliance.blockers.billing");
        case "payment_method_required":
          return t("profile.studioCompliance.blockers.payment");
        default:
          return reason;
      }
    })
    .join(" · ");

  return t("profile.studioCompliance.status.blocked", { blockers });
}

export default function StudioProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { reloadAuthSession } = useAuthSession();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference } = useThemePreference();
  const { color } = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const { isDesktopWeb } = useLayoutBreakpoint();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const accountSwitcherSheetRef = useRef<BottomSheet>(null);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedDeviceAccount[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (edit === "1") {
      router.replace(STUDIO_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "studio";

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const studioComplianceSummary = useQuery(
    api.complianceStudio.getMyStudioComplianceSummary,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const studioDiditVerification = useQuery(
    api.didit.getMyStudioDiditVerification,
    shouldLoadSettings ? emptyArgs : "skip",
  );
  const updateMyStudioSettings = useMutation(api.users.updateMyStudioSettings);
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
    router.push(STUDIO_ADD_ACCOUNT_ROUTE as Href);
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
  const profileName =
    studioSettings?.studioName ??
    currentUser?.fullName ??
    t("profile.account.fallbackName");
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
  const complianceSummaryLabel = getStudioComplianceSummaryLabel(studioComplianceSummary, t);
  const isStudioVerified = studioDiditVerification?.isVerified ?? false;
  const profileSheetContent = useMemo(
    () => (
      <View>
        <ProfileHeaderSheet
          profileName={profileName}
          roleLabel={t("profile.hero.studioProfile")}
          profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
          visualVariant="studioFeature"
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit")}
          status={profileStatus}
          bio={studioSettings?.bio}
          socialLinks={studioSettings?.socialLinks}
          sports={studioSettings?.sports ?? []}
          isVerified={isStudioVerified}
        />
      </View>
    ),
    [
      currentUser?.image,
      handleRequestEdit,
      profileName,
      profileStatus,
      studioSettings?.bio,
      studioSettings?.profileImageUrl,
      studioSettings?.socialLinks,
      studioSettings?.sports,
      isStudioVerified,
      t,
    ],
  );

  const profileSheetConfig = useMemo(
    () => ({
      render: () => ({
        children: profileSheetContent,
      }),
      steps: [0],
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      backgroundColor: color.surface,
      topInsetColor: color.surface,
    }),
    [color.surface, profileSheetContent],
  );

  const descriptorBody = (
    <TabScreenRoot
      mode="static"
      topInsetTone="sheet"
      style={[styles.screen, { backgroundColor: color.appBg }]}
    >
      {isDesktopWeb ? (
        <View style={styles.desktopShell}>
          <View style={styles.desktopRail}>
            <ProfileDesktopHeroPanel
              profileName={profileName}
              roleLabel={t("profile.hero.studioProfile")}
              profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
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
              isVerified={isStudioVerified}
              onOpenSwitcher={handleOpenAccountSwitcher}
              switcherActionLabel={t("profile.switcher.openAction")}
            />
          </View>

          <View style={styles.desktopContent}>
            <View style={styles.desktopMainColumn}>
              <ProfileSectionHeader
                label={t("profile.sections.studio")}
                icon="building.2.fill"
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
                  title={t("profile.settings.studioDetails")}
                  subtitle={
                    studioSettings?.address ??
                    t("profile.settings.completeOnboardingAddress")
                  }
                  icon="building.2.fill"
                  onPress={handleRequestEdit}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.branches.title")}
                  subtitle={branchSummary}
                  icon="square.stack.3d.up.fill"
                  onPress={() => router.push(STUDIO_BRANCHES_ROUTE as Href)}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.coverageZone")}
                  subtitle={studioSettings?.zone ?? t("profile.settings.noZone")}
                  icon="mappin.and.ellipse"
                  onPress={handleRequestEdit}
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
                  value={currentUser?.fullName ?? profileName}
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: BrandSpacing.sm,
                    paddingHorizontal: BrandSpacing.md,
                    paddingVertical: BrandSpacing.componentPadding,
                  }}
                >
                  <View style={{ width: 20, alignItems: "center", paddingTop: 2 }}>
                    <IconSymbol name="clock.fill" size={16} color={color.textMuted} />
                  </View>
                  <View style={{ flex: 1, gap: BrandSpacing.xs }}>
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
                    <View
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
                        backgroundColor={color.surfaceAlt}
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
                          backgroundColor={color.surfaceAlt}
                          selectedBackgroundColor={color.primary}
                          labelColor={color.text}
                          selectedLabelColor={color.onPrimary}
                          onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <View
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
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts")}
                  subtitle={t("profile.sections.paymentsDesc")}
                  icon="creditcard.fill"
                  onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                  showDivider
                />
                <ProfileSettingRow
                  title={t("profile.navigation.compliance")}
                  subtitle={complianceSummaryLabel}
                  icon="checkmark.shield.fill"
                  onPress={() => router.push(STUDIO_COMPLIANCE_ROUTE as Href)}
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
            </View>
          </View>
        </View>
      ) : (
        <ProfileIndexScrollView
          routeKey="studio/profile"
          style={styles.screen}
          contentContainerStyle={{
            gap: BrandSpacing.xl,
          }}
          topSpacing={BrandSpacing.md}
          bottomSpacing={BrandSpacing.xl}
        >
          <View style={styles.mobileContentPadding}>
            <ProfileSectionHeader label={t("profile.sections.studio")} icon="building.2.fill" />
            <ProfileSectionCard>
              <ProfileSettingRow
                title={t("profile.settings.publicProfile")}
                subtitle={publicProfileSummary}
                icon="person.crop.circle.fill"
                onPress={handleRequestEdit}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.studioDetails")}
                subtitle={
                  studioSettings?.address ?? t("profile.settings.completeOnboardingAddress")
                }
                icon="building.2.fill"
                onPress={handleRequestEdit}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.branches.title")}
                subtitle={branchSummary}
                icon="square.stack.3d.up.fill"
                onPress={() => router.push(STUDIO_BRANCHES_ROUTE as Href)}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.coverageZone")}
                subtitle={studioSettings?.zone ?? t("profile.settings.noZone")}
                icon="mappin.and.ellipse"
                onPress={handleRequestEdit}
              />
            </ProfileSectionCard>

            <ProfileSectionHeader
              label={t("profile.account.title")}
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
                title={t("profile.account.nameLabel")}
                value={currentUser?.fullName ?? profileName}
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
            />
            <ProfileSectionCard>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: BrandSpacing.componentPadding,
                  paddingHorizontal: BrandSpacing.insetSoft,
                  paddingVertical: BrandSpacing.componentPadding,
                }}
              >
                <View style={{ width: 20, alignItems: "center", paddingTop: 1 }}>
                  <IconSymbol name="clock.fill" size={18} color={color.secondary} />
                </View>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text
                    style={{
                      fontSize: 15,
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
                      backgroundColor={color.surfaceAlt}
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
                        backgroundColor={color.surfaceAlt}
                        selectedBackgroundColor={color.primary}
                        labelColor={color.text}
                        selectedLabelColor={color.onPrimary}
                        onPress={() => handleAutoExpireMinutesBeforeChange(minutes)}
                      />
                    ))}
                  </View>
                </View>
              </View>
              <View
                style={{
                  height: 1,
                  marginLeft: BrandSpacing.insetSoft + 32,
                  marginRight: BrandSpacing.insetSoft,
                  backgroundColor: color.border,
                }}
              />
              <ProfileSettingRow
                title={t("profile.settings.autoAcceptJobs")}
                subtitle={t("profile.settings.autoAcceptJobsDescription")}
                icon="checkmark.seal.fill"
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
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.navigation.compliance")}
                subtitle={complianceSummaryLabel}
                icon="checkmark.shield.fill"
                onPress={() => router.push(STUDIO_COMPLIANCE_ROUTE as Href)}
                showDivider
              />
              <ProfileSettingRow
                title={t("profile.settings.paymentsPayouts")}
                subtitle={t("profile.sections.paymentsDesc")}
                icon="creditcard.fill"
                onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                showDivider
              />
              <View style={{ padding: BrandSpacing.md }}>
                <ProfileSignOutButton title={t("auth.signOutButton")} onPress={handleSignOut} />
              </View>
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
            </View>
          </View>
        </ProfileIndexScrollView>
      )}
      <ProfileAccountSwitcherSheet
        innerRef={accountSwitcherSheetRef}
        onDismissed={() => undefined}
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
    </TabScreenRoot>
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
