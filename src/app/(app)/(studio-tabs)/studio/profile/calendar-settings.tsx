import { useAction, useMutation, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Text, View } from "react-native";
import appleCalendarIcon from "@/assets/images/calendar-apple-app-icon.jpg";
import googleCalendarIcon from "@/assets/images/calendar-google-app-icon.jpg";
import { LoadingScreen } from "@/components/loading-screen";
import { CalendarConnectionRow } from "@/components/profile/calendar-connection-row";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ActionButton } from "@/components/ui/action-button";
import { KitList, KitSwitchRow } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { prepareDeviceCalendarSync } from "@/lib/device-calendar-sync";
import { resolveGoogleCalendarAuthConfig } from "@/lib/google-calendar-auth-config";
import {
  connectGoogleCalendarNative,
  disconnectGoogleCalendarNative,
} from "@/lib/google-calendar-native-auth";

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

export default function StudioCalendarSettingsScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { currentUser } = useUser();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  useProfileSubpageSheet({
    title: t("profile.navigation.calendar"),
    routeMatchPath: "/profile/calendar-settings",
  });

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    currentUser?.role === "studio" ? {} : "skip",
  ) as StudioSettings | null | undefined;
  const googleStatus = useQuery(
    calendarApi.getMyGoogleCalendarStatus as any,
    currentUser?.role === "studio" ? {} : "skip",
  ) as GoogleCalendarStatus | undefined;

  const saveSettings = useMutation(api.users.updateMyStudioCalendarSettings);
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
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (studioSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
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
    <View className="flex-1" style={{ backgroundColor: palette.appBg }}>
      <ProfileSubpageScrollView
        routeKey="studio/profile/calendar-settings"
        className="flex-1"
        style={{ backgroundColor: palette.appBg }}
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingBottom: 128,
          gap: BrandSpacing.md,
        }}
      >
        <View
          className="overflow-hidden rounded-card"
          style={vars({ backgroundColor: String(palette.surface) })}
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
            palette={palette}
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
            palette={palette}
          />
        </View>

        {provider !== "none" ? (
          <KitList inset>
            <KitSwitchRow
              title={t("profile.settings.calendar.autoSync")}
              value={syncEnabled}
              disabled={isBusy}
              onValueChange={(nextValue) => {
                void onToggleSyncEnabled(nextValue);
              }}
              description={t("profile.settings.calendar.futureNote")}
            />
          </KitList>
        ) : null}

        {googleStatus?.lastError ? (
          <View
            className="px-3 py-3 rounded-button-subtle"
            style={vars({
              backgroundColor: String(palette.dangerSubtle),
              borderColor: String(palette.danger),
              borderWidth: 1,
            })}
          >
            <Text className="text-base" style={{ color: palette.danger as string }}>
              {googleStatus.lastError}
            </Text>
          </View>
        ) : null}

        {needsGoogleReconnect ? (
          <View
            className="px-3 py-3 rounded-button-subtle"
            style={vars({
              backgroundColor: String(palette.warningSubtle),
              borderColor: String(palette.warning),
              borderWidth: 1,
            })}
          >
            <Text className="text-base" style={{ color: palette.warning }}>
              {t("profile.settings.calendar.googleReconnectRequired")}
            </Text>
          </View>
        ) : null}

        {googleConfigError ? (
          <View
            className="px-3 py-3 rounded-button-subtle"
            style={vars({
              backgroundColor: String(palette.warningSubtle),
              borderColor: String(palette.warning),
              borderWidth: 1,
            })}
          >
            <Text className="text-base" style={{ color: palette.warning }}>
              {googleConfigError}
            </Text>
          </View>
        ) : null}

        {provider === "google" ? (
          <View style={vars({ gap: BrandSpacing.sm + 2 })}>
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
              palette={palette}
              fullWidth
            />
          </View>
        ) : null}
      </ProfileSubpageScrollView>

      <View className="absolute left-4 right-4 bottom-4">
        <ActionButton
          label={t("common.done")}
          onPress={() => router.back()}
          palette={palette}
          fullWidth
        />
      </View>
    </View>
  );
}
