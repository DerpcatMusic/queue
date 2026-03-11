import { useAction, useMutation, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  KitButton,
  KitList,
  KitListItem,
  KitSegmentedToggle,
  KitSwitchRow,
} from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { prepareDeviceCalendarSync } from "@/lib/device-calendar-sync";

const CALENDAR_PROVIDER_KEYS = {
  none: "profile.settings.calendar.provider.none",
  google: "profile.settings.calendar.provider.google",
  apple: "profile.settings.calendar.provider.apple",
} as const;

type CalendarProvider = keyof typeof CALENDAR_PROVIDER_KEYS;

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
  syncMyGoogleCalendarEvents: unknown;
};

type GoogleCalendarStatus = {
  connected: boolean;
  accountEmail?: string | undefined;
  lastError?: string | undefined;
};

type DisconnectGoogleCalendarResult = {
  ok: boolean;
  deletedRemoteEvents: boolean;
};

WebBrowser.maybeCompleteAuthSession();

function resolveGoogleClientId() {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_IOS;
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_ANDROID;
  }
  return process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_WEB;
}

export default function CalendarSettingsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { currentUser } = useUser();

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

  const googleClientId = resolveGoogleClientId();
  const redirectUri =
    process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_REDIRECT_URL ??
    AuthSession.makeRedirectUri({ scheme: "queue", path: "oauth/google-calendar" });

  const [googleRequest, , promptGoogleAuth] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId ?? "",
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
  const hasChanges =
    provider !== (instructorSettings.calendarProvider ?? "none") ||
    syncEnabled !== (instructorSettings.calendarSyncEnabled ?? false);

  const onSave = async () => {
    setIsSaving(true);
    try {
      let nextSyncEnabled = syncEnabled;
      const switchingAwayFromGoogle =
        instructorSettings.calendarProvider === "google" &&
        hasGoogleConnection &&
        provider !== "google";

      if (provider === "google" && !hasGoogleConnection) {
        nextSyncEnabled = false;
      }

      if (provider === "apple" && nextSyncEnabled) {
        const preparation = await prepareDeviceCalendarSync();
        if (!preparation.ok) {
          nextSyncEnabled = false;
        }
      }

      if (nextSyncEnabled !== syncEnabled) {
        setSyncEnabled(nextSyncEnabled);
      }

      let disconnectResult: DisconnectGoogleCalendarResult | null = null;
      if (switchingAwayFromGoogle) {
        disconnectResult = await disconnectGoogleCalendar({});
        if (!disconnectResult.deletedRemoteEvents) {
          Alert.alert(
            t("profile.settings.calendar.disconnectCleanupWarningTitle"),
            t("profile.settings.calendar.disconnectCleanupWarningBody"),
          );
        }
      }

      if (provider === "none") {
        router.back();
        return;
      }

      await saveSettings({
        notificationsEnabled: instructorSettings.notificationsEnabled,
        sports: instructorSettings.sports,
        calendarProvider: provider,
        calendarSyncEnabled: nextSyncEnabled,
        ...(instructorSettings.hourlyRateExpectation !== undefined
          ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation }
          : {}),
        ...(instructorSettings.address !== undefined
          ? { address: instructorSettings.address }
          : {}),
        ...(instructorSettings.latitude !== undefined
          ? { latitude: instructorSettings.latitude }
          : {}),
        ...(instructorSettings.longitude !== undefined
          ? { longitude: instructorSettings.longitude }
          : {}),
      });
      router.back();
    } catch (error) {
      Alert.alert(
        t("profile.settings.errors.saveFailed"),
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onConnectGoogle = async () => {
    if (!googleClientId || !googleRequest?.codeVerifier) {
      return;
    }

    setIsConnectingGoogle(true);
    try {
      const result = await promptGoogleAuth();
      if (result.type !== "success" || !result.params.code) {
        return;
      }

      await exchangeGoogleCode({
        code: result.params.code,
        codeVerifier: googleRequest.codeVerifier,
        redirectUri,
        clientId: googleClientId,
      });

      setProvider("google");
      setSyncEnabled(true);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const onSyncGoogleNow = async () => {
    setIsSyncingGoogle(true);
    try {
      await syncGoogleCalendar({});
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const onDisconnectGoogle = async () => {
    setIsDisconnectingGoogle(true);
    try {
      const result = await disconnectGoogleCalendar({});
      if (!result.deletedRemoteEvents) {
        Alert.alert(
          t("profile.settings.calendar.disconnectCleanupWarningTitle"),
          t("profile.settings.calendar.disconnectCleanupWarningBody"),
        );
      }
      setProvider("none");
      setSyncEnabled(false);
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const connectedDate = instructorSettings.calendarConnectedAt
    ? new Date(instructorSettings.calendarConnectedAt).toLocaleDateString(
        i18n.resolvedLanguage ?? "en",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : null;

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={[styles.screen, { backgroundColor: palette.appBg }]}
    >
      <KitList inset>
        <KitListItem title={t("profile.settings.calendar.provider.none")}>
          <View style={{ marginTop: 8 }}>
            <KitSegmentedToggle<CalendarProvider>
              value={provider}
              onChange={(next) => {
                setProvider(next);
                if (next === "none") setSyncEnabled(false);
              }}
              options={(Object.keys(CALENDAR_PROVIDER_KEYS) as CalendarProvider[]).map((key) => ({
                value: key,
                label: t(CALENDAR_PROVIDER_KEYS[key]),
              }))}
            />
          </View>
        </KitListItem>
      </KitList>

      <View style={{ paddingTop: 8 }}>
        <KitList inset>
          <KitSwitchRow
            title={t("profile.settings.calendar.autoSync")}
            value={syncEnabled}
            disabled={provider === "none" || (provider === "google" && !hasGoogleConnection)}
            onValueChange={setSyncEnabled}
            description={t("profile.settings.calendar.futureNote")}
          />
          {provider === "google" ? (
            <KitListItem
              title={
                hasGoogleConnection
                  ? t("profile.settings.calendar.googleConnectedAs", {
                      email: googleStatus?.accountEmail ?? "Google account",
                    })
                  : t("profile.settings.calendar.googleConnectRequired")
              }
            />
          ) : null}
          {provider === "apple" ? (
            <KitListItem title={t("profile.settings.calendar.applePermissionNote")} />
          ) : null}
          {provider === "google" && googleStatus?.lastError ? (
            <KitListItem title={googleStatus.lastError} />
          ) : null}
          {connectedDate ? (
            <KitListItem
              title={t("profile.settings.calendar.lastConnected", {
                date: connectedDate,
              })}
            />
          ) : null}
        </KitList>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: BrandSpacing.md, gap: 10 }}>
        {provider === "google" ? (
          <View style={{ gap: 10 }}>
            {!hasGoogleConnection ? (
              <KitButton
                label={
                  isConnectingGoogle
                    ? t("profile.settings.actions.connecting")
                    : t("profile.settings.calendar.actions.connectGoogle")
                }
                onPress={() => {
                  void onConnectGoogle();
                }}
                disabled={isConnectingGoogle || !googleClientId || !googleRequest}
              />
            ) : (
              <>
                <KitButton
                  label={
                    isSyncingGoogle
                      ? t("profile.settings.actions.syncing")
                      : t("profile.settings.calendar.actions.syncNow")
                  }
                  onPress={() => {
                    void onSyncGoogleNow();
                  }}
                  disabled={isSyncingGoogle}
                />
                <KitButton
                  label={
                    isDisconnectingGoogle
                      ? t("profile.settings.actions.disconnecting")
                      : t("profile.settings.calendar.actions.disconnectGoogle")
                  }
                  variant="secondary"
                  onPress={() => {
                    void onDisconnectGoogle();
                  }}
                  disabled={isDisconnectingGoogle}
                />
              </>
            )}
          </View>
        ) : null}

        <KitButton
          label={
            isSaving ? t("profile.settings.actions.saving") : t("profile.settings.actions.save")
          }
          onPress={() => {
            void onSave();
          }}
          disabled={isSaving || !hasChanges}
        />
        <KitButton label={t("common.cancel")} variant="secondary" onPress={() => router.back()} />
      </View>
    </TabScreenScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
