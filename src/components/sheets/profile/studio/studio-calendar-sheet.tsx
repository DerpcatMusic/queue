import { useAction, useMutation, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Text } from "react-native";
import appleCalendarIcon from "@/assets/images/calendar-apple-app-icon.jpg";
import googleCalendarIcon from "@/assets/images/calendar-google-app-icon.jpg";
import { LoadingScreen } from "@/components/loading-screen";
import { CalendarConnectionRow } from "@/components/profile/calendar-connection-row";
import { ActionButton } from "@/components/ui/action-button";
import { KitList, KitListItem, KitSwitch } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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
import { Box } from "@/primitives";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ScrollView } from "react-native";

type CalendarProvider = "none" | "google" | "apple";

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

type StudioSettings = {
  calendarProvider: CalendarProvider;
  calendarSyncEnabled: boolean;
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

interface StudioCalendarSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioCalendarSheet({ visible, onClose }: StudioCalendarSheetProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const theme = useTheme();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const studioSettings = useQuery(
    api.studios.settings.getMyStudioSettings,
    currentUser?.role === "studio" ? {} : "skip",
  ) as StudioSettings | null | undefined;
  const googleStatus = useQuery(
    calendarApi.getMyGoogleCalendarStatus as any,
    currentUser?.role === "studio" ? {} : "skip",
  ) as GoogleCalendarStatus | undefined;

  const saveSettings = useMutation(api.studios.settings.updateMyStudioCalendarSettings);
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
    if (studioSettings && !seeded) {
      setProvider(studioSettings.calendarProvider ?? "none");
      setSyncEnabled(studioSettings.calendarSyncEnabled ?? false);
      setSeeded(true);
    }
  }, [seeded, studioSettings]);

  if (studioSettings === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
  }
  if (studioSettings === null) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.unavailable")} />
      </BaseProfileSheet>
    );
  }

  const hasGoogleConnection = Boolean(googleStatus?.connected);
  const hasGoogleRefreshToken = Boolean(googleStatus?.hasRefreshToken);
  const needsGoogleReconnect = hasGoogleConnection && !hasGoogleRefreshToken;
  const canUseGoogleCalendar = hasGoogleConnection && hasGoogleRefreshToken;
  const isGoogleConnected = provider === "google" && canUseGoogleCalendar;
  const isAppleConnected = provider === "apple";
  const isBusy = isSaving || isConnectingGoogle || isDisconnectingGoogle || isSyncingGoogle;

  const persistCalendarSettings = async (
    nextProvider: CalendarProvider,
    nextSyncEnabled: boolean,
  ) => {
    await saveSettings({
      calendarProvider: nextProvider,
      calendarSyncEnabled: nextSyncEnabled,
    });
    setProvider(nextProvider);
    setSyncEnabled(nextSyncEnabled);
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

      await persistCalendarSettings("google", true);
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
      await persistCalendarSettings("none", false);
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

      await persistCalendarSettings("apple", true);
    } catch (error) {
      showSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDisconnectApple = async () => {
    setIsSaving(true);
    try {
      await persistCalendarSettings("none", false);
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

      await persistCalendarSettings(provider, nextValue);
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

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.appBg }}
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingBottom: 128,
          gap: BrandSpacing.md,
        }}
      >
        <Box
          style={{
            overflow: "hidden",
            borderRadius: BrandRadius.card,
            backgroundColor: theme.color.surfaceElevated,
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

        {googleStatus?.lastError ? (
          <Box
            style={{
              paddingHorizontal: BrandSpacing.sm,
              paddingVertical: BrandSpacing.sm,
              borderRadius: BrandRadius.buttonSubtle,
              backgroundColor: theme.color.dangerSubtle,
              borderWidth: BorderWidth.thin,
              borderColor: theme.color.danger,
            }}
          >
            <Text style={{ fontSize: 16, color: theme.color.danger }}>
              {googleStatus.lastError}
            </Text>
          </Box>
        ) : null}

        {needsGoogleReconnect || googleConfigError ? (
          <Box
            style={{
              paddingHorizontal: BrandSpacing.sm,
              paddingVertical: BrandSpacing.sm,
              borderRadius: BrandRadius.buttonSubtle,
              backgroundColor: theme.color.warningSubtle,
              borderWidth: BorderWidth.thin,
              borderColor: theme.color.warning,
            }}
          >
            <Text style={{ fontSize: 16, color: theme.color.warning }}>
              {googleConfigError ?? t("profile.settings.calendar.googleReconnectRequired")}
            </Text>
          </Box>
        ) : null}

        {provider === "google" ? (
          <Box style={{ gap: BrandSpacing.stackDense }}>
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
      </ScrollView>

      <Box
        style={{
          position: "absolute",
          left: BrandSpacing.md,
          right: BrandSpacing.md,
          bottom: BrandSpacing.md,
        }}
      >
        <ActionButton label={t("common.done")} onPress={onClose} fullWidth />
      </Box>
    </BaseProfileSheet>
  );
}
