import { useMutation, useQuery } from "convex/react";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { SettingsUnavailableScreen } from "@/components/profile/settings-unavailable-screen";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { Box, Text } from "@/primitives";

const REMINDER_OPTIONS = [15, 30, 45, 60] as const;

type NotificationSettingsRole = "instructor" | "studio";
type NotificationPreferenceKey =
  | "job_offer"
  | "insurance_renewal"
  | "application_received"
  | "application_updates"
  | "lesson_reminder"
  | "lesson_updates";

function getPushErrorMessage(error: unknown, t: TFunction) {
  if (isPushRegistrationError(error)) {
    switch (error.code) {
      case "permission_denied":
        return t("jobsTab.errors.pushPermissionRequired");
      case "expo_go_unsupported":
        return t("jobsTab.errors.pushUnavailableInExpoGo");
      case "physical_device_required":
        return t("jobsTab.errors.pushRequiresPhysicalDevice");
      case "native_module_unavailable":
        return t("jobsTab.errors.pushUnavailableInBuild");
      case "web_unsupported":
        return t("jobsTab.errors.pushUnsupportedOnWeb");
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : t("profile.notifications.updateFailed");
}

function getPreferenceCopy(
  key: NotificationPreferenceKey,
  t: TFunction,
): { title: string; description: string } {
  switch (key) {
    case "job_offer":
      return {
        title: t("profile.notifications.preferences.jobOfferTitle"),
        description: t("profile.notifications.preferences.jobOfferDescription"),
      };
    case "insurance_renewal":
      return {
        title: t("profile.notifications.preferences.insuranceRenewalTitle"),
        description: t("profile.notifications.preferences.insuranceRenewalDescription"),
      };
    case "application_received":
      return {
        title: t("profile.notifications.preferences.applicationReceivedTitle"),
        description: t("profile.notifications.preferences.applicationReceivedDescription"),
      };
    case "application_updates":
      return {
        title: t("profile.notifications.preferences.applicationUpdatesTitle"),
        description: t("profile.notifications.preferences.applicationUpdatesDescription"),
      };
    case "lesson_reminder":
      return {
        title: t("profile.notifications.preferences.lessonReminderTitle"),
        description: t("profile.notifications.preferences.lessonReminderDescription"),
      };
    case "lesson_updates":
      return {
        title: t("profile.notifications.preferences.lessonUpdatesTitle"),
        description: t("profile.notifications.preferences.lessonUpdatesDescription"),
      };
  }
}

export function NotificationSettingsScreen({
  actorRole,
  routeMatchPath,
}: {
  actorRole: NotificationSettingsRole;
  routeMatchPath: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { overlayBottom } = useAppInsets();
  const { currentUser } = useUser();
  useProfileSubpageSheet({
    title: t("profile.navigation.notifications"),
    routeMatchPath,
  });

  const settings = useQuery(
    api.notifications.settings.getMyNotificationSettings,
    currentUser?.role === actorRole ? {} : "skip",
  );
  const updateSettings = useMutation(api.notifications.settings.updateMyNotificationSettings);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (settings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (settings === null) {
    return <SettingsUnavailableScreen label={t("profile.settings.unavailable")} />;
  }

  const saveSettings = async (args: {
    notificationsEnabled?: boolean;
    expoPushToken?: string;
    lessonReminderMinutesBefore?: number;
    preferenceUpdates?: Array<{ key: NotificationPreferenceKey; enabled: boolean }>;
  }) => {
    await updateSettings({
      notificationsEnabled: args.notificationsEnabled ?? settings.notificationsEnabled,
      ...(args.expoPushToken !== undefined ? { expoPushToken: args.expoPushToken } : {}),
      ...(args.lessonReminderMinutesBefore !== undefined
        ? { lessonReminderMinutesBefore: args.lessonReminderMinutesBefore }
        : {}),
      ...(args.preferenceUpdates ? { preferenceUpdates: args.preferenceUpdates } : {}),
    });
  };

  const togglePushNotifications = async (nextValue: boolean) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (nextValue) {
        const token = await registerForPushNotificationsAsync();
        await saveSettings({
          notificationsEnabled: true,
          expoPushToken: token,
        });
        setStatusMessage(t("jobsTab.success.pushEnabled"));
      } else {
        await saveSettings({
          notificationsEnabled: false,
        });
        setStatusMessage(t("profile.notifications.pushDisabled"));
      }
    } catch (error) {
      if (isPushRegistrationError(error) && error.code === "permission_denied") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: t("onboarding.push.permissionNotGranted"),
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
      setErrorMessage(getPushErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePreference = async (key: NotificationPreferenceKey, enabled: boolean) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await saveSettings({
        preferenceUpdates: [{ key, enabled }],
      });
      setStatusMessage(t("profile.notifications.preferenceSaved"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.notifications.updateFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectReminderMinutes = async (minutes: (typeof REMINDER_OPTIONS)[number]) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await saveSettings({
        lessonReminderMinutesBefore: minutes,
      });
      setStatusMessage(t("profile.notifications.reminderSaved", { minutes }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("jobsTab.errors.failedToSetReminder"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
      <ProfileSubpageScrollView
        routeKey={`${actorRole}/profile/notifications`}
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.inset,
          paddingBottom: overlayBottom + BrandSpacing.xxl,
          gap: BrandSpacing.stackRoomy,
        }}
      >
        <Box style={{ gap: BrandSpacing.stackTight }}>
          <Text style={[BrandType.radarLabel, { color: theme.color.textMuted }]}>
            {t("profile.navigation.notifications")}
          </Text>
          <Text style={[BrandType.heading, { color: theme.color.text }]}>
            {t("profile.notifications.title")}
          </Text>
          <Text style={[BrandType.body, { color: theme.color.textMuted }]}>
            {actorRole === "instructor"
              ? t("profile.notifications.instructorDescription")
              : t("profile.notifications.studioDescription")}
          </Text>
        </Box>

        <ProfileSectionHeader label={t("profile.notifications.pushSection")} icon="bell.fill" />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={t("profile.notifications.pushToggleTitle")}
            subtitle={
              settings.notificationsEnabled
                ? t("profile.notifications.pushToggleOn")
                : t("profile.notifications.pushToggleOff")
            }
            icon="bell.fill"
            accessory={
              <KitSwitch
                disabled={isSubmitting}
                value={settings.notificationsEnabled}
                onValueChange={(value) => {
                  void togglePushNotifications(value);
                }}
              />
            }
            showDivider
          />
          <ProfileSettingRow
            title={t("profile.notifications.deviceStatusTitle")}
            subtitle={
              settings.hasExpoPushToken
                ? t("profile.notifications.deviceStatusReady")
                : t("profile.notifications.deviceStatusMissing")
            }
            icon="iphone.gen3"
          />
        </ProfileSectionCard>

        <ProfileSectionHeader
          label={t("profile.notifications.alertsSection")}
          icon="bell.badge.fill"
        />
        <ProfileSectionCard>
          {settings.availablePreferenceKeys.map((key, index) => {
            const copy = getPreferenceCopy(key, t);
            return (
              <ProfileSettingRow
                key={key}
                title={copy.title}
                subtitle={copy.description}
                icon={key === "lesson_reminder" ? "calendar.badge.clock" : "bell.badge.fill"}
                accessory={
                  <KitSwitch
                    disabled={isSubmitting}
                    value={settings.preferences[key]}
                    onValueChange={(value) => {
                      void togglePreference(key, value);
                    }}
                  />
                }
                showDivider={index < settings.availablePreferenceKeys.length - 1}
              />
            );
          })}
        </ProfileSectionCard>

        <ProfileSectionHeader
          label={t("profile.notifications.lessonReminderSection")}
          icon="calendar.badge.clock"
        />
        <ProfileSectionCard>
          {REMINDER_OPTIONS.map((minutes, index) => (
            <ProfileSettingRow
              key={minutes}
              title={t("profile.notifications.reminderOption", { minutes })}
              subtitle={t("profile.notifications.reminderOptionDescription", { minutes })}
              icon="clock.fill"
              accessory={
                settings.lessonReminderMinutesBefore === minutes ? (
                  <IconSymbol name="checkmark.circle.fill" size={20} color={theme.color.primary} />
                ) : null
              }
              onPress={() => {
                void selectReminderMinutes(minutes);
              }}
              showDivider={index < REMINDER_OPTIONS.length - 1}
            />
          ))}
        </ProfileSectionCard>

        <ProfileSectionHeader
          label={t("profile.notifications.locationGroundworkTitle")}
          icon="location.fill"
        />
        <ProfileSectionCard>
          <Box style={{ gap: BrandSpacing.xs, padding: BrandSpacing.componentPadding }}>
            <Text style={[BrandType.bodyMedium, { color: theme.color.text }]}>
              {t("profile.notifications.locationGroundworkBody")}
            </Text>
            <Text style={[BrandType.body, { color: theme.color.textMuted }]}>
              {t("profile.notifications.locationGroundworkFootnote")}
            </Text>
          </Box>
        </ProfileSectionCard>

        {statusMessage ? (
          <Text style={[BrandType.body, { color: theme.color.success }]}>{statusMessage}</Text>
        ) : null}
        {errorMessage ? (
          <Text style={[BrandType.body, { color: theme.color.danger }]}>{errorMessage}</Text>
        ) : null}
      </ProfileSubpageScrollView>
    </Box>
  );
}
