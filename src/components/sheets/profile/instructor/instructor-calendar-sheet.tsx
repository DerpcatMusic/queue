import { useAction, useMutation, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable, Text } from "react-native";

import appleCalendarIcon from "@/assets/images/calendar-apple-app-icon.jpg";
import googleCalendarIcon from "@/assets/images/calendar-google-app-icon.jpg";
import { LoadingScreen } from "@/components/loading-screen";
import { CalendarConnectionRow } from "@/components/profile/calendar-connection-row";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { KitList, KitListItem, KitSwitch } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { prepareDeviceCalendarSync } from "@/lib/device-calendar-sync";
import { resolveGoogleCalendarAuthConfig } from "@/lib/google-calendar-auth-config";
import {
  connectGoogleCalendarNative,
  disconnectGoogleCalendarNative,
} from "@/lib/google-calendar-native-auth";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { Box } from "@/primitives";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";

type CalendarProvider = "none" | "google" | "apple";
const LESSON_REMINDER_OPTIONS = [15, 30, 45, 60] as const;

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const calendarApi = (api as unknown as { calendar: Record<string, unknown> }).calendar as {
  getMyGoogleCalendarStatus: unknown;
  disconnectGoogleCalendar: unknown;
  connectGoogleCalendarWithCode: unknown;
  connectGoogleCalendarWithServerAuthCode: unknown;
  syncMyGoogleCalendarEvents: unknown;
};

type GoogleCalendarStatus = {
  connected: boolean;
  hasRefreshToken: boolean;
  accountEmail?: string | undefined;
  lastError?: string | undefined;
};

type DisconnectGoogleCalendarResult = {
  ok: boolean;
  deletedRemoteEvents: boolean;
};

function showCalendarPermissionAlert(t: ReturnType<typeof useTranslation>["t"]) {
  showOpenSettingsAlert({
    title: t("common.permissionRequired"),
    body: t("profile.settings.calendar.permissionRequiredBody"),
    cancelLabel: t("common.cancel"),
    settingsLabel: t("common.openSettings"),
  });
}

interface InstructorCalendarSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorCalendarSheet({ visible, onClose }: InstructorCalendarSheetProps) {
  const { t } = useTranslation();

  const theme = useTheme();
  const { currentUser } = useUser();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  useEffect(() => {
    if (visible) {
      // Sheet is now visible - any additional setup can go here
    }
  }, [visible]);

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const googleStatus = useQuery(
    calendarApi.getMyGoogleCalendarStatus as any,
    currentUser?.role === "instructor" ? {} : "skip",
  ) as GoogleCalendarStatus | undefined;

  const saveSettings = useMutation(api.users.updateMyInstructorSettings);
  const disconnectGoogleCalendar = useAction(calendarApi.disconnectGoogleCalendar as any) as (
    args: Record<string, never>,
  ) => Promise<DisconnectGoogleCalendarResult>;
  const exchangeGoogleCode = useAction(calendarApi.connectGoogleCalendarWithCode as any) as (args: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
  }) => Promise<unknown>;
  const exchangeGoogleServerAuthCode = useAction(
    calendarApi.connectGoogleCalendarWithServerAuthCode as any,
  ) as (args: { serverAuthCode: string }) => Promise<unknown>;
  const syncGoogleCalendar = useAction(calendarApi.syncMyGoogleCalendarEvents as any) as (args: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) => Promise<unknown>;

  const [provider, setProvider] = useState<CalendarProvider>("none");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lessonReminderMinutesBefore, setLessonReminderMinutesBefore] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const googleAuthConfig = resolveGoogleCalendarAuthConfig(Platform.OS);
  const googleClientId = googleAuthConfig.clientId;
  const googleServerClientId = googleAuthConfig.serverClientId;
  const redirectUri = googleAuthConfig.redirectUri;
  const googleConfigError = googleAuthConfig.configError;

  const [googleRequest, , promptGoogleAuth] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId ?? googleServerClientId ?? "",
      scopes: GOOGLE_SCOPES,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      redirectUri,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
    GOOGLE_DISCOVERY,
  );

  useEffect(() => {
    if (instructorSettings && !seeded) {
      setProvider((instructorSettings.calendarProvider as CalendarProvider) ?? "none");
      setSyncEnabled(instructorSettings.calendarSyncEnabled ?? false);
      setNotificationsEnabled(instructorSettings.notificationsEnabled);
      setLessonReminderMinutesBefore(instructorSettings.lessonReminderMinutesBefore ?? 30);
      setSeeded(true);
    }
  }, [instructorSettings, seeded]);

  if (instructorSettings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (instructorSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  const hasGoogleConnection = Boolean(googleStatus?.connected);
  const hasGoogleRefreshToken = Boolean(googleStatus?.hasRefreshToken);
  const needsGoogleReconnect = hasGoogleConnection && !hasGoogleRefreshToken;
  const canUseGoogleCalendar = hasGoogleConnection && hasGoogleRefreshToken;
  const isGoogleConnected = provider === "google" && canUseGoogleCalendar;
  const isAppleConnected = provider === "apple";
  const isBusy = isSaving || isConnectingGoogle || isDisconnectingGoogle || isSyncingGoogle;

  const persistInstructorSettings = async ({
    nextProvider = provider,
    nextSyncEnabled = syncEnabled,
    nextNotificationsEnabled = notificationsEnabled,
    nextLessonReminderMinutesBefore = lessonReminderMinutesBefore,
    nextExpoPushToken,
  }: {
    nextProvider?: CalendarProvider;
    nextSyncEnabled?: boolean;
    nextNotificationsEnabled?: boolean;
    nextLessonReminderMinutesBefore?: number;
    nextExpoPushToken?: string;
  }) => {
    await saveSettings({
      notificationsEnabled: nextNotificationsEnabled,
      lessonReminderMinutesBefore: nextLessonReminderMinutesBefore,
      sports: instructorSettings.sports,
      calendarProvider: nextProvider,
      calendarSyncEnabled: nextSyncEnabled,
      ...(instructorSettings.hourlyRateExpectation !== undefined
        ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation }
        : {}),
      ...(instructorSettings.address !== undefined ? { address: instructorSettings.address } : {}),
      ...(instructorSettings.latitude !== undefined
        ? { latitude: instructorSettings.latitude }
        : {}),
      ...(instructorSettings.longitude !== undefined
        ? { longitude: instructorSettings.longitude }
        : {}),
      ...(nextExpoPushToken !== undefined ? { expoPushToken: nextExpoPushToken } : {}),
    });
    setProvider(nextProvider);
    setSyncEnabled(nextSyncEnabled);
    setNotificationsEnabled(nextNotificationsEnabled);
    setLessonReminderMinutesBefore(nextLessonReminderMinutesBefore);
  };

  const showSaveError = (error: unknown) => {
    Alert.alert(
      t("profile.settings.errors.saveFailed"),
      error instanceof Error ? error.message : undefined,
    );
  };

  const disconnectGoogleConnection = async () => {
    const result = await disconnectGoogleCalendar({});
    if (Platform.OS === "android") {
      await disconnectGoogleCalendarNative().catch(() => {
        /* best-effort */
      });
    }
    if (!result.deletedRemoteEvents) {
      Alert.alert(
        t("profile.settings.calendar.disconnectCleanupWarningTitle"),
        t("profile.settings.calendar.disconnectCleanupWarningBody"),
      );
    }
  };

  const onConnectGoogle = async () => {
    if (googleConfigError) {
      Alert.alert(t("profile.settings.errors.saveFailed"), googleConfigError);
      return;
    }

    if (Platform.OS === "android") {
      if (!googleServerClientId) {
        Alert.alert(
          t("profile.settings.errors.saveFailed"),
          t("profile.calendar.configErrors.androidBuildMissing"),
        );
        return;
      }
    } else if (!googleClientId || !googleRequest?.codeVerifier) {
      Alert.alert(
        t("profile.settings.errors.saveFailed"),
        t("profile.calendar.configErrors.buildMissing"),
      );
      return;
    }

    const googleCodeVerifier = googleRequest?.codeVerifier;
    const resolvedGoogleClientId = googleClientId;

    setIsConnectingGoogle(true);
    try {
      if (Platform.OS === "android") {
        const nativeResult = await connectGoogleCalendarNative({
          serverClientId: googleServerClientId!,
          scopes: GOOGLE_SCOPES,
        });
        if (nativeResult.type === "cancelled") {
          return;
        }

        await exchangeGoogleServerAuthCode({
          serverAuthCode: nativeResult.serverAuthCode,
        });
      } else {
        const result = await promptGoogleAuth();
        if (result.type !== "success" || !result.params.code) {
          return;
        }

        await exchangeGoogleCode({
          code: result.params.code,
          codeVerifier: googleCodeVerifier!,
          redirectUri,
          clientId: resolvedGoogleClientId!,
        });
      }

      await persistInstructorSettings({ nextProvider: "google", nextSyncEnabled: true });
    } catch (error) {
      Alert.alert(
        t("profile.settings.errors.saveFailed"),
        error instanceof Error
          ? error.message
          : t("profile.calendar.configErrors.connectionFailed"),
      );
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const onDisconnectGoogle = async () => {
    setIsDisconnectingGoogle(true);
    try {
      await disconnectGoogleConnection();
      await persistInstructorSettings({ nextProvider: "none", nextSyncEnabled: false });
    } catch (error) {
      showSaveError(error);
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const onSelectApple = async () => {
    setIsSaving(true);
    try {
      const preparation = await prepareDeviceCalendarSync();
      if (!preparation.ok) {
        if (preparation.reason === "permission_denied") {
          showCalendarPermissionAlert(t);
        }
        return;
      }

      if (hasGoogleConnection) {
        await disconnectGoogleConnection();
      }

      await persistInstructorSettings({ nextProvider: "apple", nextSyncEnabled: true });
    } catch (error) {
      showSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDisconnectApple = async () => {
    setIsSaving(true);
    try {
      await persistInstructorSettings({ nextProvider: "none", nextSyncEnabled: false });
    } catch (error) {
      showSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleSyncEnabled = async (nextValue: boolean) => {
    const previousValue = syncEnabled;
    setSyncEnabled(nextValue);
    setIsSaving(true);

    try {
      if (provider === "apple" && nextValue) {
        const preparation = await prepareDeviceCalendarSync();
        if (!preparation.ok) {
          if (preparation.reason === "permission_denied") {
            showCalendarPermissionAlert(t);
          }
          setSyncEnabled(previousValue);
          return;
        }
      }

      await persistInstructorSettings({ nextProvider: provider, nextSyncEnabled: nextValue });
    } catch (error) {
      setSyncEnabled(previousValue);
      showSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onSyncGoogleNow = async () => {
    if (!canUseGoogleCalendar) {
      Alert.alert(
        t("profile.settings.errors.saveFailed"),
        t("profile.settings.calendar.googleReconnectRequired"),
      );
      return;
    }
    setIsSyncingGoogle(true);
    try {
      await syncGoogleCalendar({});
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const getPushErrorMessage = (error: unknown) => {
    if (isPushRegistrationError(error)) {
      switch (error.code) {
        case "permission_denied":
          return t("profile.settings.calendar.notifications.permissionRequired");
        case "expo_go_unsupported":
          return t("profile.settings.calendar.notifications.expoGoUnsupported");
        case "physical_device_required":
          return t("profile.settings.calendar.notifications.deviceRequired");
        case "native_module_unavailable":
          return t("profile.settings.calendar.notifications.nativeModuleUnavailable");
        case "web_unsupported":
          return t("profile.settings.calendar.notifications.webUnsupported");
        default:
          break;
      }
    }

    return error instanceof Error && error.message
      ? error.message
      : t("profile.settings.errors.saveFailed");
  };

  const onToggleNotifications = async (nextValue: boolean) => {
    setIsSaving(true);
    try {
      if (!nextValue) {
        await persistInstructorSettings({ nextNotificationsEnabled: false });
        return;
      }

      const token = await registerForPushNotificationsAsync();
      await persistInstructorSettings({
        nextNotificationsEnabled: true,
        nextExpoPushToken: token,
      });
    } catch (error) {
      if (isPushRegistrationError(error) && error.code === "permission_denied") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: t("profile.settings.calendar.notifications.permissionRequired"),
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
      Alert.alert(t("profile.settings.errors.saveFailed"), getPushErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const onSelectLessonReminderMinutes = async (nextValue: number) => {
    if (nextValue === lessonReminderMinutesBefore || isBusy) {
      return;
    }

    const previousValue = lessonReminderMinutesBefore;
    setLessonReminderMinutesBefore(nextValue);
    setIsSaving(true);
    try {
      await persistInstructorSettings({
        nextLessonReminderMinutesBefore: nextValue,
      });
    } catch (error) {
      setLessonReminderMinutesBefore(previousValue);
      showSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDisconnectGoogle = () => {
    Alert.alert(
      t("profile.settings.calendar.disconnectGoogleTitle"),
      t("profile.settings.calendar.disconnectGoogleBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.disconnect"),
          style: "destructive",
          onPress: () => {
            void onDisconnectGoogle();
          },
        },
      ],
    );
  };

  const confirmDisconnectApple = () => {
    Alert.alert(
      t("profile.settings.calendar.disconnectAppleTitle"),
      t("profile.settings.calendar.disconnectAppleBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.disconnect"),
          style: "destructive",
          onPress: () => {
            void onDisconnectApple();
          },
        },
      ],
    );
  };

  const handleGoogleRowPress = () => {
    if (isBusy) {
      return;
    }

    if (isGoogleConnected) {
      confirmDisconnectGoogle();
      return;
    }

    if (isAppleConnected) {
      Alert.alert(
        t("profile.settings.calendar.switchToGoogleTitle"),
        t("profile.settings.calendar.switchToGoogleBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.settings.calendar.connectAction"),
            onPress: () => {
              void onConnectGoogle();
            },
          },
        ],
      );
      return;
    }

    void onConnectGoogle();
  };

  const handleAppleRowPress = () => {
    if (isBusy) {
      return;
    }

    if (isAppleConnected) {
      confirmDisconnectApple();
      return;
    }

    if (isGoogleConnected) {
      Alert.alert(
        t("profile.settings.calendar.switchToAppleTitle"),
        t("profile.settings.calendar.switchToAppleBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.settings.calendar.connectAction"),
            onPress: () => {
              void onSelectApple();
            },
          },
        ],
      );
      return;
    }

    void onSelectApple();
  };

  const pushStatusDescription = notificationsEnabled
    ? t("profile.settings.calendar.notifications.enabled")
    : instructorSettings.hasExpoPushToken
      ? t("profile.settings.calendar.notifications.disabled")
      : t("profile.settings.calendar.notifications.off");

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
        <Box
          style={{
            overflow: "hidden",
            borderRadius: BrandRadius.soft,
            backgroundColor: theme.color.surfaceElevated as string,
          }}
        >
          <CalendarConnectionRow
            iconSource={googleCalendarIcon}
            title={t("profile.settings.calendar.provider.google")}
            detail={
              isGoogleConnected
                ? (googleStatus?.accountEmail ?? t("profile.calendar.googleAccountFallback"))
                : needsGoogleReconnect
                  ? t("profile.settings.calendar.googleReconnectRequired")
                  : t("profile.settings.calendar.connectHint")
            }
            connected={isGoogleConnected}
            loading={isConnectingGoogle || isDisconnectingGoogle}
            onPress={handleGoogleRowPress}
            showDivider
          />

          <CalendarConnectionRow
            iconSource={appleCalendarIcon}
            title={t("profile.settings.calendar.provider.apple")}
            detail={
              isAppleConnected
                ? t("profile.settings.calendar.appleConnectedHint")
                : t("profile.settings.calendar.connectHint")
            }
            connected={isAppleConnected}
            loading={isSaving && !isConnectingGoogle && !isDisconnectingGoogle}
            onPress={handleAppleRowPress}
          />
        </Box>

        {provider !== "none" ? (
          <KitList inset>
            <KitListItem
              title={t("profile.settings.calendar.autoSync")}
              accessory={
                <KitSwitch
                  value={syncEnabled}
                  disabled={isBusy}
                  onValueChange={(nextValue) => {
                    void onToggleSyncEnabled(nextValue);
                  }}
                />
              }
            ></KitListItem>
          </KitList>
        ) : null}

        <KitList inset>
          <KitListItem
            title={t("profile.settings.calendar.notifications.title")}
            accessory={
              <KitSwitch
                value={notificationsEnabled}
                disabled={isBusy}
                onValueChange={(nextValue) => {
                  void onToggleNotifications(nextValue);
                }}
              />
            }
          >
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {pushStatusDescription}
            </ThemedText>
          </KitListItem>
        </KitList>

        <Box style={{ gap: BrandSpacing.sm }}>
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {t("profile.settings.calendar.notifications.reminderTitle")}
          </Text>
          <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
            {LESSON_REMINDER_OPTIONS.map((option) => {
              const selected = option === lessonReminderMinutesBefore;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={isBusy}
                  onPress={() => {
                    void onSelectLessonReminderMinutes(option);
                  }}
                  style={{
                    borderRadius: BrandRadius.pill,
                    backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
                    paddingHorizontal: BrandSpacing.controlX,
                    paddingVertical: BrandSpacing.controlY,
                    shadowColor: "#000000",
                    shadowOpacity: selected ? 0.08 : 0.04,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 1,
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? theme.color.onPrimary : theme.color.text,
                      fontSize: BrandType.body.fontSize,
                      lineHeight: 20,
                    }}
                  >
                    {t("profile.settings.calendar.notifications.reminderValue", {
                      minutes: option,
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </Box>
        </Box>

        {googleStatus?.lastError ? (
          <Box
            style={{
              borderRadius: BrandRadius.md,
              paddingHorizontal: BrandSpacing.controlX,
              paddingVertical: BrandSpacing.controlY,
              borderWidth: BorderWidth.thin,
              borderCurve: "continuous",
              backgroundColor: theme.color.dangerSubtle as string,
              borderColor: theme.color.danger as string,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 16,
                fontWeight: "400",
                lineHeight: 22,
                color: theme.color.danger as string,
              }}
            >
              {googleStatus.lastError}
            </Text>
          </Box>
        ) : null}

        {needsGoogleReconnect || googleConfigError ? (
          <Box
            style={{
              borderRadius: BrandRadius.md,
              paddingHorizontal: BrandSpacing.controlX,
              paddingVertical: BrandSpacing.controlY,
              borderWidth: BorderWidth.thin,
              borderCurve: "continuous",
              backgroundColor: theme.color.warningSubtle,
              borderColor: theme.color.warning,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 16,
                fontWeight: "400",
                lineHeight: 22,
                color: theme.color.warning,
              }}
            >
              {googleConfigError ?? t("profile.settings.calendar.googleReconnectRequired")}
            </Text>
          </Box>
        ) : null}

        {provider === "google" ? (
          <Box style={{ gap: BrandSpacing.stackTight }}>
            <ActionButton
              label={
                isSyncingGoogle
                  ? t("profile.settings.actions.syncing")
                  : t("profile.settings.calendar.actions.syncNow")
              }
              onPress={() => {
                void onSyncGoogleNow();
              }}
              disabled={!canUseGoogleCalendar || isSyncingGoogle || isBusy}
              fullWidth
            />
          </Box>
        ) : null}
      </Box>
    </BaseProfileSheet>
  );
}
