import { useAuthActions } from "@convex-dev/auth/react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type StyleProp,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  getProfileHeroScrollTopPadding,
  ProfileDesktopHeroPanel,
  ProfileHeroSheet,
} from "@/components/profile/profile-hero-sheet";
import { ProfileReadinessStrip } from "@/components/profile/profile-readiness-strip";
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

function ProfileCardGroup({
  children,
  palette,
  style,
}: {
  children: ReactNode;
  palette: BrandPalette;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.cardGroup, { backgroundColor: palette.appBg }, style]}>{children}</View>
  );
}

export default function StudioProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { safeTop } = useAppInsets();
  const { preference, setPreference } = useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
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
  const isDesktopWeb = process.env.EXPO_OS === "web" && width >= 1180;
  const socialCount = Object.keys(studioSettings?.socialLinks ?? {}).length;
  const sportsCount = studioSettings?.sports?.length ?? 0;
  const setupActions = [
    !studioSettings?.address ? { label: "Add studio details", onPress: handleRequestEdit } : null,
    !studioSettings?.zone ? { label: "Set coverage zone", onPress: handleRequestEdit } : null,
    sportsCount === 0 ? { label: "Pick sports", onPress: handleRequestEdit } : null,
    socialCount === 0 ? { label: "Add contact links", onPress: handleRequestEdit } : null,
  ].filter((item): item is { label: string; onPress: () => void } => item !== null);
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
  const readinessItems = [
    {
      label: "Action queue",
      value: setupActions.length === 0 ? "Profile ready" : `${String(setupActions.length)} open`,
      caption: primarySetupAction?.label ?? "Coverage, profile, and defaults are lined up.",
      accent: setupActions.length === 0 ? (palette.success as string) : (palette.warning as string),
      ...(primarySetupAction ? { onPress: primarySetupAction.onPress } : {}),
    },
    {
      label: "Public profile",
      value: sportsCount === 0 ? "Needs shape" : `${String(sportsCount)} sports`,
      caption: socialCount > 0 ? `${String(socialCount)} links live` : "Photo, bio, and links",
      onPress: handleRequestEdit,
    },
    {
      label: "Coverage",
      value: studioSettings?.zone ?? "Unset",
      caption: studioSettings?.address ?? "Add your studio address and operating area",
      onPress: handleRequestEdit,
    },
    {
      label: "Defaults",
      value: `${String(studioSettings?.autoExpireMinutesBefore ?? 30)} min`,
      caption: "Auto-expire before start",
    },
  ];
  return (
    <View collapsable={false} style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="studio/profile"
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: isDesktopWeb ? 24 : getProfileHeroScrollTopPadding(safeTop),
          paddingHorizontal: isDesktopWeb ? 24 : 0,
          paddingBottom: 40,
          gap: isDesktopWeb ? 24 : 0,
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
                highlights={readinessItems}
              />
            </View>

            <View style={styles.desktopContent}>
              <View style={styles.desktopMainColumn}>
                <ProfileSectionHeader
                  label="Studio"
                  description="The identity and operating defaults people scan first."
                  palette={palette}
                  flush
                />
                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    eyebrow="Command"
                    title="Public profile"
                    subtitle={publicProfileSummary}
                    onPress={handleRequestEdit}
                    palette={palette}
                  />
                  <ProfileSettingRow
                    eyebrow="Location"
                    title="Studio details"
                    subtitle={studioSettings?.address ?? "Complete onboarding to set your address"}
                    onPress={handleRequestEdit}
                    palette={palette}
                  />
                  <ProfileSettingRow
                    eyebrow="Coverage"
                    title="Coverage zone"
                    subtitle={studioSettings?.zone ?? "No zone"}
                    onPress={handleRequestEdit}
                    palette={palette}
                  />
                  <ProfileSettingRow
                    eyebrow="Scheduling"
                    title="Auto-expire jobs"
                    subtitle={`${String(studioSettings?.autoExpireMinutesBefore ?? 30)} minutes before start`}
                    palette={palette}
                    isLast
                  />
                </ProfileCardGroup>
              </View>

              <View style={styles.desktopSideColumn}>
                <ProfileSectionHeader
                  label={t("profile.account.title")}
                  description="Identity, role, and membership details."
                  palette={palette}
                  flush
                />
                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.account.nameLabel")}
                    subtitle={currentUser?.fullName ?? profileName}
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

                <ProfileSectionHeader
                  label={t("profile.appearance.title")}
                  description="Language and theme controls."
                  palette={palette}
                  flush
                />
                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
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

                <ProfileSectionHeader
                  label={t("profile.settings.calendar.title")}
                  description="Choose whether posted jobs sync into your calendar."
                  palette={palette}
                  flush
                />
                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.settings.calendar.title")}
                    subtitle={calendarSummary}
                    onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                    palette={palette}
                    isLast
                  />
                </ProfileCardGroup>

                <ProfileSectionHeader
                  label="Payments"
                  description="Manage the payout destination for this studio."
                  palette={palette}
                  flush
                />
                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title="Payments & payouts"
                    subtitle="Open payout settings and manage destination details."
                    onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                    palette={palette}
                    isLast
                  />
                </ProfileCardGroup>

                <ProfileCardGroup palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle="End the current session on this device."
                    onPress={() => void signOut()}
                    palette={palette}
                    tone="danger"
                    isLast
                    accessory={
                      <IconSymbol name="arrow.right.square" size={24} color={palette.danger} />
                    }
                  />
                </ProfileCardGroup>
              </View>
            </View>
          </View>
        ) : (
          <>
            <ProfileReadinessStrip palette={palette} items={readinessItems} />

            <ProfileSectionHeader
              label="Studio"
              description="The identity and operating defaults people scan first."
              palette={palette}
            />
            <ProfileCardGroup palette={palette}>
              <ProfileSettingRow
                eyebrow="Command"
                title="Public profile"
                subtitle={publicProfileSummary}
                onPress={handleRequestEdit}
                palette={palette}
              />
              <ProfileSettingRow
                eyebrow="Location"
                title="Studio details"
                subtitle={studioSettings?.address ?? "Complete onboarding to set your address"}
                onPress={handleRequestEdit}
                palette={palette}
              />
              <ProfileSettingRow
                eyebrow="Coverage"
                title="Coverage zone"
                subtitle={studioSettings?.zone ?? "No zone"}
                onPress={handleRequestEdit}
                palette={palette}
              />
              <ProfileSettingRow
                eyebrow="Scheduling"
                title="Auto-expire jobs"
                subtitle={`${String(studioSettings?.autoExpireMinutesBefore ?? 30)} minutes before start`}
                palette={palette}
                isLast
              />
            </ProfileCardGroup>

            <ProfileSectionHeader
              label={t("profile.account.title")}
              description="Identity, role, and membership details."
              palette={palette}
            />
            <ProfileCardGroup palette={palette}>
              <ProfileSettingRow
                title={t("profile.account.nameLabel")}
                subtitle={currentUser?.fullName ?? profileName}
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

            <ProfileSectionHeader
              label={t("profile.appearance.title")}
              description="Language and theme controls."
              palette={palette}
            />
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

            <ProfileSectionHeader
              label={t("profile.settings.calendar.title")}
              description="Choose whether posted jobs sync into your calendar."
              palette={palette}
            />
            <ProfileCardGroup palette={palette}>
              <ProfileSettingRow
                title={t("profile.settings.calendar.title")}
                subtitle={calendarSummary}
                onPress={() => router.push(STUDIO_CALENDAR_SETTINGS_ROUTE as Href)}
                palette={palette}
                isLast
              />
            </ProfileCardGroup>

            <ProfileSectionHeader
              label="Payments"
              description="Manage the payout destination for this studio."
              palette={palette}
            />
            <ProfileCardGroup palette={palette}>
              <ProfileSettingRow
                title="Payments & payouts"
                subtitle="Open payout settings and manage destination details."
                onPress={() => router.push(STUDIO_PAYMENTS_ROUTE as Href)}
                palette={palette}
                isLast
              />
            </ProfileCardGroup>

            <View style={{ marginTop: 32, marginBottom: 40 }}>
              <ProfileCardGroup palette={palette}>
                <ProfileSettingRow
                  title={t("auth.signOutButton")}
                  subtitle="End the current session on this device."
                  onPress={() => void signOut()}
                  palette={palette}
                  tone="danger"
                  isLast
                  accessory={
                    <IconSymbol name="arrow.right.square" size={24} color={palette.danger} />
                  }
                />
              </ProfileCardGroup>
            </View>
          </>
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
  cardGroup: {
    gap: 10,
    marginHorizontal: 24,
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
});
