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
      router.replace(INSTRUCTOR_EDIT_ROUTE as Href);
    }
  }, [edit, router]);
  const emptyArgs = useMemo(() => ({}), []);
  const shouldLoadSettings = currentUser?.role === "instructor" && hasActivated;

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

  if (!hasActivated || (currentUser?.role === "instructor" && instructorSettings === undefined)) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

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
        ? "Google"
        : "Apple";
  const sportsCount = instructorSettings?.sports?.length ?? 0;
  const socialCount = Object.keys(instructorSettings?.socialLinks ?? {}).length;
  const setupActions = [
    !identityVerified
      ? {
          label: t("profile.setup.verifyIdentity", { defaultValue: "Verify identity" }),
          onPress: () => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href),
          icon: "checkmark.circle.fill" as const,
        }
      : null,
    !bankConnected
      ? {
          label: t("profile.setup.connectPayouts", { defaultValue: "Connect payouts" }),
          onPress: () => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href),
          icon: "sparkles" as const,
        }
      : null,
    sportsCount === 0
      ? {
          label: t("profile.setup.chooseSports", { defaultValue: "Choose sports" }),
          onPress: () => router.push(INSTRUCTOR_SPORTS_ROUTE as Href),
          icon: "sparkles" as const,
        }
      : null,
    !provider || provider === "none"
      ? {
          label: t("profile.setup.linkCalendar", { defaultValue: "Link calendar" }),
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
      ? t("profile.setup.statusReady", { defaultValue: "Ready to run jobs" })
      : t("profile.setup.statusPending", {
          count: setupActions.length,
          defaultValue: `${String(setupActions.length)} polish moves left`,
        });

  const publicProfileSummary =
    instructorSettings?.bio?.trim() ||
    (socialCount > 0
      ? t("profile.settings.publicProfileActive", {
          count: socialCount,
          defaultValue: `${String(socialCount)} public links are live.`,
        })
      : t("profile.settings.publicProfilePrompt", {
          defaultValue: "Shape the identity people scan before they apply or accept.",
        }));

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
                profileName={nameValue}
                roleLabel={
                  identityVerified
                    ? t("profile.hero.verifiedInstructor", { defaultValue: "Verified instructor" })
                    : t("profile.hero.instructorProfile", { defaultValue: "Instructor profile" })
                }
                profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
                palette={palette}
                summary={publicProfileSummary}
                statusLabel={setupStatusLabel}
                metaLabel={
                  memberSince
                    ? t("profile.account.memberSinceValue", {
                        date: memberSince,
                        defaultValue: `Member since ${memberSince}`,
                      })
                    : sportsSummary
                }
                primaryAction={{
                  label: t("profile.actions.edit", { defaultValue: "Edit profile" }),
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
                          defaultValue: `Next: ${primarySetupAction.label.toLowerCase()}`,
                        })
                      : t("profile.setup.allClear", {
                          defaultValue: "Your profile is fully configured.",
                        })
                  }
                />

                <ProfileSectionHeader
                  label={t("profile.sections.professional", { defaultValue: "Professional" })}
                  description={t("profile.sections.professionalDesc", {
                    defaultValue: "What studios scan before they book you.",
                  })}
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.settings.publicProfile", { defaultValue: "Public profile" })}
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
                  <ProfileSettingRow
                    title={t("profile.settings.calendar.title")}
                    subtitle={calendarSummary}
                    icon="calendar.badge.clock"
                    onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
                    palette={palette}
                  />
                </ProfileSectionCard>
              </View>

              <View style={styles.desktopSideColumn}>
                <ProfileSectionHeader
                  label={t("profile.account.title")}
                  description={t("profile.sections.accountDesc", {
                    defaultValue: "Identity, role, and membership details.",
                  })}
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.account.nameLabel")}
                    value={currentUser?.fullName ?? nameValue}
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
                  description={t("profile.sections.appearanceDesc", {
                    defaultValue: "Language and theme controls.",
                  })}
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
                  label={t("profile.sections.payments", { defaultValue: "Payments" })}
                  description={t("profile.sections.paymentsDesc", {
                    defaultValue: "Destination and payout readiness.",
                  })}
                  palette={palette}
                  flush
                />
                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("profile.settings.paymentsPayouts", {
                      defaultValue: "Payments & payouts",
                    })}
                    subtitle={
                      bankConnected
                        ? t("profile.settings.payoutsConnected", {
                            defaultValue: "Verified destination connected.",
                          })
                        : t("profile.settings.payoutsNeeded", {
                            defaultValue: "Add a verified bank destination.",
                          })
                    }
                    icon="creditcard.fill"
                    onPress={() => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href)}
                    palette={palette}
                  />
                </ProfileSectionCard>

                <ProfileSectionCard palette={palette} style={styles.desktopCardGroup}>
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle={t("profile.settings.signOutDesc", {
                      defaultValue: "End session on this device.",
                    })}
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
                    ? t("profile.setup.nextStep", {
                        step: primarySetupAction.label.toLowerCase(),
                        defaultValue: `Next: ${primarySetupAction.label.toLowerCase()}`,
                      })
                    : t("profile.setup.allClear", {
                        defaultValue: "Your profile is fully configured.",
                      })
                }
              />
            </View>
            <View style={styles.mobileSectionsContainer}>
              <ProfileSectionHeader
                label={t("profile.sections.professional", { defaultValue: "Professional" })}
                description={t("profile.sections.professionalDesc", {
                  defaultValue: "What studios scan before they book you.",
                })}
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.publicProfile", { defaultValue: "Public profile" })}
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
                <ProfileSettingRow
                  title={t("profile.settings.calendar.title")}
                  subtitle={calendarSummary}
                  icon="calendar.badge.clock"
                  onPress={() => router.push(INSTRUCTOR_CALENDAR_SETTINGS_ROUTE as Href)}
                  palette={palette}
                />
              </ProfileSectionCard>

              <ProfileSectionHeader
                label={t("profile.account.title")}
                description={t("profile.sections.accountDesc", {
                  defaultValue: "Identity, role, and membership details.",
                })}
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.account.nameLabel")}
                  value={currentUser?.fullName ?? nameValue}
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
                description={t("profile.sections.appearanceDesc", {
                  defaultValue: "Language and theme controls.",
                })}
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
                label={t("profile.sections.payments", { defaultValue: "Payments" })}
                description={t("profile.sections.paymentsDesc", {
                  defaultValue: "Destination and payout readiness.",
                })}
                palette={palette}
              />
              <ProfileSectionCard palette={palette}>
                <ProfileSettingRow
                  title={t("profile.settings.paymentsPayouts", {
                    defaultValue: "Payments & payouts",
                  })}
                  subtitle={
                    bankConnected
                      ? t("profile.settings.payoutsConnected", {
                          defaultValue: "Verified destination connected.",
                        })
                      : t("profile.settings.payoutsNeeded", {
                          defaultValue: "Add a verified bank destination.",
                        })
                  }
                  icon="creditcard.fill"
                  onPress={() => router.push(INSTRUCTOR_PAYMENTS_ROUTE as Href)}
                  palette={palette}
                />
              </ProfileSectionCard>

              <View style={{ marginTop: 32, marginBottom: 40 }}>
                <ProfileSectionCard palette={palette}>
                  <ProfileSettingRow
                    title={t("auth.signOutButton")}
                    subtitle={t("profile.settings.signOutDesc", {
                      defaultValue: "End session on this device.",
                    })}
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
          profileName={nameValue}
          roleLabel={
            identityVerified
              ? t("profile.role.verifiedInstructor", { defaultValue: "Verified instructor" })
              : t("profile.role.instructorProfile", { defaultValue: "Instructor profile" })
          }
          profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser?.image}
          palette={palette}
          scrollY={scrollY}
          onRequestEdit={handleRequestEdit}
          primaryActionLabel={t("profile.actions.edit", { defaultValue: "Edit profile" })}
          {...(primarySetupAction ? { secondaryAction: primarySetupAction } : {})}
          statusLabel={setupStatusLabel}
          bio={instructorSettings?.bio}
          socialLinks={instructorSettings?.socialLinks}
          sports={instructorSettings?.sports ?? []}
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
