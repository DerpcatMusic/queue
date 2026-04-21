/**
 * Studio Notifications Sheet - notification settings for studios.
 */

import { useMutation, useQuery } from "convex/react";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileSettingRow } from "@/components/profile/profile-settings-sections";
import { SettingsUnavailableScreen } from "@/components/profile/settings-unavailable-screen";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { Box, Text } from "@/primitives";

const REMINDER_OPTIONS = [15, 30, 45, 60] as const;

type NotificationPreferenceKey =
  | "job_offer"
  | "insurance_renewal"
  | "application_received"
  | "application_updates"
  | "lesson_reminder"
  | "lesson_updates";

interface StudioNotificationsSheetProps {
  visible: boolean;
  onClose: () => void;
}

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
): { title: string; icon: string } {
  switch (key) {
    case "job_offer":
      return {
        title: t("profile.notifications.preferences.jobOfferTitle"),
        icon: "briefcase.fill",
      };
    case "insurance_renewal":
      return {
        title: t("profile.notifications.preferences.insuranceRenewalTitle"),
        icon: "shield.lefthalf.filled",
      };
    case "application_received":
      return {
        title: t("profile.notifications.preferences.applicationReceivedTitle"),
        icon: "person.badge.plus",
      };
    case "application_updates":
      return {
        title: t("profile.notifications.preferences.applicationUpdatesTitle"),
        icon: "person.crop.circle.fill",
      };
    case "lesson_reminder":
      return {
        title: t("profile.notifications.preferences.lessonReminderTitle"),
        icon: "calendar.badge.clock",
      };
    case "lesson_updates":
      return {
        title: t("profile.notifications.preferences.lessonUpdatesTitle"),
        icon: "calendar.badge.plus",
      };
  }
}

export function StudioNotificationsSheet({ visible, onClose }: StudioNotificationsSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { currentUser } = useUser();

  const settings = useQuery(
    api.notifications.settings.getMyNotificationSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );
  const updateSettings = useMutation(api.notifications.settings.updateMyNotificationSettings);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (currentUser === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
  }
  if (currentUser === null || settings === null) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <SettingsUnavailableScreen label={t("profile.settings.unavailable")} />
      </BaseProfileSheet>
    );
  }
  if (settings === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
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
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={s.root}>
        {/* ── Sheet Header ── */}
        <Box style={s.sheetHeader}>
          <View style={[s.headerIcon, { backgroundColor: theme.color.tertiarySubtle }]}>
            <IconSymbol name="bell.fill" size={20} color={theme.color.tertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color="text">
              {t("profile.notifications.title")}
            </Text>
          </View>
        </Box>

        {/* ── Push Master Toggle ── */}
        <View style={s.sectionLabel}>
          <IconSymbol name="bell.fill" size={14} color={theme.color.textMuted} />
          <Text variant="labelStrong" color="textMuted">
            {t("profile.notifications.pushSection")}
          </Text>
        </View>
        <ProfileSettingRow
          title={t("profile.notifications.pushToggleTitle")}
          icon="bell.fill"
          sectionTone="preferences"
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
          icon="iphone.gen3"
          sectionTone="preferences"
        />

        {/* ── Alert Preferences ── */}
        <View style={s.sectionLabel}>
          <IconSymbol name="bell.badge.fill" size={14} color={theme.color.textMuted} />
          <Text variant="labelStrong" color="textMuted">
            {t("profile.notifications.alertsSection")}
          </Text>
        </View>
        {settings.availablePreferenceKeys.map((key, index) => {
          const copy = getPreferenceCopy(key, t);
          return (
            <ProfileSettingRow
              key={key}
              title={copy.title}
              icon={copy.icon}
              sectionTone="operations"
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

        {/* ── Lesson Reminder ── */}
        <View style={s.sectionLabel}>
          <IconSymbol name="calendar.badge.clock" size={14} color={theme.color.textMuted} />
          <Text variant="labelStrong" color="textMuted">
            {t("profile.notifications.lessonReminderSection")}
          </Text>
        </View>
        <Box style={s.reminderRow}>
          {REMINDER_OPTIONS.map((minutes) => {
            const selected = settings.lessonReminderMinutesBefore === minutes;
            return (
              <Pressable
                key={minutes}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={isSubmitting}
                onPress={() => {
                  void selectReminderMinutes(minutes);
                }}
                style={[
                  s.reminderPill,
                  {
                    backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  variant="bodyMedium"
                  style={{
                    color: selected ? theme.color.onPrimary : theme.color.text,
                  }}
                >
                  {t("profile.notifications.reminderOption", { minutes })}
                </Text>
              </Pressable>
            );
          })}
        </Box>

        {/* ── Status Banners ── */}
        {statusMessage ? (
          <View
            style={[
              s.statusBanner,
              { backgroundColor: theme.color.successSubtle, borderLeftColor: theme.color.success },
            ]}
          >
            <IconSymbol name="checkmark.circle.fill" size={18} color={theme.color.success} />
            <Text variant="bodyMedium" style={{ color: theme.color.success, flex: 1 }}>
              {statusMessage}
            </Text>
          </View>
        ) : null}
        {errorMessage ? (
          <View
            style={[
              s.statusBanner,
              { backgroundColor: theme.color.dangerSubtle, borderLeftColor: theme.color.danger },
            ]}
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={theme.color.danger} />
            <Text variant="bodyMedium" style={{ color: theme.color.danger, flex: 1 }}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </Box>
    </BaseProfileSheet>
  );
}

const s = StyleSheet.create(() => ({
  root: {
    gap: BrandSpacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  reminderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  reminderPill: {
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.sm,
    borderCurve: "continuous",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    borderRadius: BrandRadius.md,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    borderLeftWidth: 3,
  },
}));
