import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, View } from "react-native";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
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
      router.replace(STUDIO_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "studio" && hasActivated;

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    shouldLoadSettings ? emptyArgs : "skip",
  );

  const handleRequestEdit = useCallback(() => {
    router.push(STUDIO_EDIT_ROUTE as Href);
  }, [router]);

  if (!hasActivated || (currentUser?.role === "studio" && studioSettings === undefined)) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

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
        ? "Google"
        : "Apple";
  const socialCount = Object.keys(studioSettings?.socialLinks ?? {}).length;
  const sportsCount = studioSettings?.sports?.length ?? 0;
  const setupActions = [
    !studioSettings?.address
      ? { label: "Add studio details", onPress: handleRequestEdit, icon: "sparkles" as const }
      : null,
    !studioSettings?.zone
      ? {
          label: "Set coverage zone",
          onPress: handleRequestEdit,
          icon: "mappin.and.ellipse" as const,
        }
      : null,
    sportsCount === 0
      ? { label: "Pick sports", onPress: handleRequestEdit, icon: "sparkles" as const }
      : null,
    socialCount === 0
      ? { label: "Add contact links", onPress: handleRequestEdit, icon: "sparkles" as const }
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
      ? "Ready to run jobs"
      : `${String(setupActions.length)} polish moves left`;
  const publicProfileSummary =
    studioSettings?.bio?.trim() ||
    (socialCount > 0
      ? `${String(socialCount)} public links are live for applicants and instructors.`
      : "Shape the studio identity people scan before they apply or accept.");
  const primarySetupAction = setupActions[0] ?? null;
  return (
    <View collapsable={false} style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        topInsetTone="sheet"
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: isDesktopWeb ? 24 : getProfileHeroScrollTopPadding(safeTop),
          paddingHorizontal: isDesktopWeb ? 24 : 0,
          paddingBottom: 40,
          gap: 24,
        }}
      >
        {isDesktopWeb ? (
          <View style={styles.desktopShell}>
            <View style={styles.desktopRail}>
              <ProfileDesktopHeroPanel
                profileName={profileName}
                roleLabel="Studio profile"
                profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
                palette={palette}
                summary={publicProfileSummary}
                statusLabel={setupStatusLabel}
                metaLabel={memberSince ? `Member since ${memberSince}` : sportsSummary}
                primaryAction={{ label: "Edit profile", onPress: handleRequestEdit }}
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
                      ? `Next: ${primarySetupAction.label.toLowerCase()}`
                      : "Your studio profile is fully configured."
                  }
                />

                <ProfileSectionHeader
                  label="Studio"
                  description="The identity and operating defaults people scan first."
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title="Public profile"
                    subtitle={publicProfileSummary}
                    icon="person.crop.circle.fill"
                    onPress={handleRequestEdit}
                    palette={palette}
                    showDivider
                  />
                  <ProfileSettingRow
                    title="Studio details"
                    subtitle={studioSettings?.address ?? "Complete onboarding to set your address"}
                    icon="building.2.fill"
                    onPress={handleRequestEdit}
                    palette={palette}
                    showDivider
                  />
                  <ProfileSettingRow
                    title="Coverage zone"
                    subtitle={studioSettings?.zone ?? "No zone"}
                    icon="mappin.and.ellipse"
                    onPress={handleRequestEdit}
                    palette={palette}
                    showDivider
                  />
                  <ProfileSettingRow
                    title="Auto-expire jobs"
                    value={`${String(studioSettings?.autoExpireMinutesBefore ?? 30)} min`}
                    icon="clock.fill"
                    palette={palette}
                  />
                </ProfileSectionCard>
              </View>

              <View style={styles.desktopSideColumn}>
                <ProfileSectionHeader
                  label={t("profile.account.title")}
                  description="Identity, role, and membership details."
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
                    showDivider={Boolean(memberSince)}
                  />
                  {memberSince ? (
                    <ProfileSettingRow
                      title={t("profile.account.memberSince")}
                      value={memberSince}
                      icon="calendar.circle.fill"
                      palette={palette}
                    />
                  ) : null}
                </ProfileSectionCard>

                <ProfileSectionHeader
                  label={t("profile.appearance.title")}
                  description="Language and theme controls."
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
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
                  label={t("profile.settings.calendar.title")}
                  description="Choose whether posted jobs sync into your calendar."
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.settings.calendar.title")}
                    subtitle={calendarSummary}
                    icon="calendar.circle.fill"
                    onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                    palette={palette}
                  />
                </ProfileSectionCard>

                <ProfileSectionHeader
                  label="Payments"
                  description="Manage the payout destination for this studio."
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title="Payments & payouts"
                    subtitle="Open payout settings and manage destination details."
                    icon="creditcard.fill"
                    onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                    palette={palette}
                  />
                </ProfileSectionCard>

                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle="End the current session on this device."
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
          <View style={styles.mobileContentPadding}>
            <View style={{ marginBottom: 32 }}>
              <ProfileReadinessBanner
                palette={palette}
                primaryAction={primarySetupAction}
                statusLabel={setupStatusLabel}
                subtitleLabel={
                  primarySetupAction
                    ? `Next: ${primarySetupAction.label.toLowerCase()}`
                    : "Your studio profile is fully configured."
                }
              />
            </View>
            <View style={styles.mobileSectionsContainer}>
              <ProfileSectionHeader
                label="Studio"
                description="The identity and operating defaults people scan first."
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title="Public profile"
                  subtitle={publicProfileSummary}
                  icon="person.crop.circle.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title="Studio details"
                  subtitle={studioSettings?.address ?? "Complete onboarding to set your address"}
                  icon="building.2.fill"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title="Coverage zone"
                  subtitle={studioSettings?.zone ?? "No zone"}
                  icon="mappin.and.ellipse"
                  onPress={handleRequestEdit}
                  palette={palette}
                  showDivider
                />
                <ProfileSettingRow
                  title="Auto-expire jobs"
                  value={`${String(studioSettings?.autoExpireMinutesBefore ?? 30)} min`}
                  icon="clock.fill"
                  palette={palette}
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.account.title")}
                description="Identity, role, and membership details."
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
                  showDivider={Boolean(memberSince)}
                />
                {memberSince ? (
                  <ProfileSettingRow
                    title={t("profile.account.memberSince")}
                    value={memberSince}
                    icon="calendar.circle.fill"
                    palette={palette}
                  />
                ) : null}
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.appearance.title")}
                description="Language and theme controls."
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
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
                label={t("profile.settings.calendar.title")}
                description="Choose whether posted jobs sync into your calendar."
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.circle.fill"
                  onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label="Payments"
                description="Manage the payout destination for this studio."
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title="Payments & payouts"
                  subtitle="Open payout settings and manage destination details."
                  icon="creditcard.fill"
                  onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                  palette={palette}
                />
              </ProfileSectionCard>

              <View style={{ marginTop: 32, marginBottom: 40 }}>
                <ProfileSectionCard palette={palette}>
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle="End the current session on this device."
                    icon="arrow.right.square"
                    onPress={() => void signOut()}
                    palette={palette}
                    tone="danger"
                  />
                </ProfileSectionCard>
              </View>
            </View>
          </View>
        )}
      </TabScreenScrollView>

      {isDesktopWeb ? null : (
        <ProfileHeroSheet
          profileName={profileName}
          roleLabel="Studio profile"
          profileImageUrl={studioSettings?.profileImageUrl ?? currentUser?.image}
          palette={palette}
          scrollY={scrollY}
          onRequestEdit={handleRequestEdit}
          primaryActionLabel="Edit profile"
          {...(primarySetupAction ? { secondaryAction: primarySetupAction } : {})}
          statusLabel={setupStatusLabel}
          bio={studioSettings?.bio}
          socialLinks={studioSettings?.socialLinks}
          sports={studioSettings?.sports ?? []}
        />
      )}
    </View>
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
