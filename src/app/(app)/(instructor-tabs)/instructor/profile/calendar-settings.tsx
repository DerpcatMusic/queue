import { useAction, useMutation, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ActionButton } from "@/components/ui/action-button";
import {
  BrandRadius,
  BrandSpacing,
  BrandType,
  type BrandPalette,
} from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { prepareDeviceCalendarSync } from "@/lib/device-calendar-sync";

const CALENDAR_PROVIDER_KEYS = {
  none: "profile.settings.calendar.provider.none",
  google: "profile.settings.calendar.provider.google",
  apple: "profile.settings.calendar.provider.apple",
} as const;

type CalendarProvider = keyof typeof CALENDAR_PROVIDER_KEYS;

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const calendarApi = (api as unknown as { calendar: Record<string, unknown> })
  .calendar as {
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

type ProviderOptionProps = {
  value: CalendarProvider;
  title: string;
  description: string;
  selected: boolean;
  onPress: (value: CalendarProvider) => void;
  palette: BrandPalette;
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

function StatusSignal({
  label,
  value,
  palette,
  tone = "surface",
}: {
  label: string;
  value: string;
  palette: BrandPalette;
  tone?: "surface" | "accent";
}) {
  const backgroundColor =
    tone === "accent"
      ? (palette.primarySubtle as string)
      : (palette.surfaceElevated as string);
  const labelColor =
    tone === "accent"
      ? (palette.primary as string)
      : (palette.textMuted as string);

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 2,
        borderRadius: BrandRadius.card - 6,
        borderCurve: "continuous",
        backgroundColor,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: labelColor,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.bodyStrong,
          color: palette.text as string,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ProviderOption({
  value,
  title,
  description,
  selected,
  onPress,
  palette,
}: ProviderOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={({ pressed }) => ({
        gap: 6,
        borderWidth: 1,
        borderRadius: BrandRadius.button,
        borderCurve: "continuous",
        borderColor: selected
          ? (palette.primary as string)
          : (palette.border as string),
        backgroundColor: selected
          ? (palette.primarySubtle as string)
          : (palette.surfaceElevated as string),
        paddingHorizontal: 14,
        paddingVertical: 14,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text
            style={{
              ...BrandType.bodyStrong,
              color: palette.text as string,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMuted as string,
            }}
          >
            {description}
          </Text>
        </View>
        <View
          style={[
            styles.providerBadge,
            {
              backgroundColor: selected
                ? (palette.primary as string)
                : (palette.surface as string),
              borderColor: selected
                ? (palette.primary as string)
                : (palette.borderStrong as string),
            },
          ]}
        >
          <Text
            style={{
              ...BrandType.micro,
              color: selected
                ? (palette.onPrimary as string)
                : (palette.textMuted as string),
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {selected ? "Live" : "Pick"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CalendarSettingsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { overlayBottom } = useAppInsets();
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
  const disconnectGoogleCalendar = useAction(
    calendarApi.disconnectGoogleCalendar as any,
  ) as (args: Record<string, never>) => Promise<DisconnectGoogleCalendarResult>;
  const exchangeGoogleCode = useAction(
    calendarApi.connectGoogleCalendarWithCode as any,
  ) as (args: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
  }) => Promise<unknown>;
  const syncGoogleCalendar = useAction(
    calendarApi.syncMyGoogleCalendarEvents as any,
  ) as (args: {
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
    AuthSession.makeRedirectUri({
      scheme: "queue",
      path: "oauth/google-calendar",
    });

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
      setProvider(
        (instructorSettings.calendarProvider as CalendarProvider) ?? "none",
      );
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
  const connectedDate = instructorSettings.calendarConnectedAt
    ? new Date(instructorSettings.calendarConnectedAt).toLocaleDateString(
        i18n.resolvedLanguage ?? "en",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : null;

  const providerLabel = t(CALENDAR_PROVIDER_KEYS[provider]);
  const syncStateLabel =
    provider === "none"
      ? t("profile.calendar.syncOff", { defaultValue: "Off" })
      : syncEnabled
        ? t("profile.calendar.syncOn", { defaultValue: "Auto-add on" })
        : t("profile.calendar.syncManual", { defaultValue: "Manual" });
  const heroTitle =
    provider === "google"
      ? hasGoogleConnection
        ? t("profile.calendar.heroGoogleLive", {
            defaultValue: "Google sync is live",
          })
        : t("profile.calendar.heroGooglePending", {
            defaultValue: "Connect Google to go live",
          })
      : provider === "apple"
        ? t("profile.calendar.heroApple", {
            defaultValue: "Device calendar sync is ready",
          })
        : t("profile.calendar.heroOff", {
            defaultValue: "Calendar sync is off",
          });
  const heroBody =
    provider === "google"
      ? hasGoogleConnection
        ? t("profile.calendar.heroGoogleLiveBody", {
            defaultValue:
              "Accepted sessions can flow straight into your Google calendar with one active connection.",
          })
        : t("profile.calendar.heroGooglePendingBody", {
            defaultValue:
              "Pick Google, connect the account, then decide whether new sessions auto-land or stay manual.",
          })
      : provider === "apple"
        ? t("profile.calendar.heroAppleBody", {
            defaultValue:
              "Queue writes accepted sessions into your device calendar after you grant local calendar access.",
          })
        : t("profile.calendar.heroOffBody", {
            defaultValue:
              "Leave sync off if you want Queue to stay separate from your personal scheduling stack.",
          });

  const handleProviderChange = (next: CalendarProvider) => {
    setProvider(next);
    if (next === "none") {
      setSyncEnabled(false);
    }
  };

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

      if (switchingAwayFromGoogle) {
        const disconnectResult = await disconnectGoogleCalendar({});
        if (!disconnectResult.deletedRemoteEvents) {
          Alert.alert(
            t("profile.settings.calendar.disconnectCleanupWarningTitle"),
            t("profile.settings.calendar.disconnectCleanupWarningBody"),
          );
        }
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

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/profile"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: 148,
          gap: BrandSpacing.lg,
        }}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.surfaceAlt as string,
              borderColor: palette.border as string,
            },
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroCopy}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  letterSpacing: 0.8,
                }}
              >
                {t("profile.settings.calendar.title").toUpperCase()}
              </Text>
              <Text
                style={{
                  ...BrandType.heading,
                  color: palette.text as string,
                }}
              >
                {heroTitle}
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted as string,
                }}
              >
                {heroBody}
              </Text>
            </View>
            <View
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.primarySubtle as string },
              ]}
            >
              <IconSymbol
                name="calendar.badge.clock"
                size={22}
                color={palette.primary as string}
              />
            </View>
          </View>

          <View style={styles.heroSignalsRow}>
            <StatusSignal
              label={t("profile.calendar.signalProvider", {
                defaultValue: "Provider",
              })}
              value={providerLabel}
              palette={palette}
              tone={provider === "none" ? "surface" : "accent"}
            />
            <StatusSignal
              label={t("profile.calendar.signalSync", {
                defaultValue: "Mode",
              })}
              value={syncStateLabel}
              palette={palette}
            />
          </View>
        </View>

        <View style={{ gap: BrandSpacing.sm }}>
          <ProfileSectionHeader
            label={t("profile.calendar.providerLabel", {
              defaultValue: "Provider",
            })}
            description={t("profile.settings.calendar.description")}
            icon="calendar.badge.clock"
            palette={palette}
            flush
          />
          <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
            <View style={styles.sectionBody}>
              <ProviderOption
                value="none"
                title={t(CALENDAR_PROVIDER_KEYS.none)}
                description={t("profile.calendar.providerNoneBody", {
                  defaultValue:
                    "Keep Queue self-contained and skip calendar export entirely.",
                })}
                selected={provider === "none"}
                onPress={handleProviderChange}
                palette={palette}
              />
              <ProviderOption
                value="google"
                title={t(CALENDAR_PROVIDER_KEYS.google)}
                description={t("profile.calendar.providerGoogleBody", {
                  defaultValue:
                    "Push accepted sessions into the connected Google calendar account.",
                })}
                selected={provider === "google"}
                onPress={handleProviderChange}
                palette={palette}
              />
              <ProviderOption
                value="apple"
                title={t(CALENDAR_PROVIDER_KEYS.apple)}
                description={t("profile.calendar.providerAppleBody", {
                  defaultValue:
                    "Write accepted sessions into the device calendar on this phone.",
                })}
                selected={provider === "apple"}
                onPress={handleProviderChange}
                palette={palette}
              />
            </View>
          </ProfileSectionCard>
        </View>

        <View style={{ gap: BrandSpacing.sm }}>
          <ProfileSectionHeader
            label={t("profile.calendar.commandLabel", {
              defaultValue: "Command",
            })}
            description={t("profile.calendar.commandBody", {
              defaultValue:
                "Choose whether accepted sessions auto-land in your calendar or stay available for manual sync.",
            })}
            icon="sparkles"
            palette={palette}
            flush
          />
          <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
            <View style={styles.sectionBody}>
              <View
                style={[
                  styles.toggleRow,
                  {
                    borderColor: palette.border as string,
                    backgroundColor: palette.surfaceElevated as string,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                  <Text
                    style={{
                      ...BrandType.bodyStrong,
                      color: palette.text as string,
                    }}
                  >
                    {t("profile.settings.calendar.autoSync")}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.textMuted as string,
                    }}
                  >
                    {t("profile.settings.calendar.futureNote")}
                  </Text>
                </View>
                <Switch
                  value={syncEnabled}
                  onValueChange={setSyncEnabled}
                  disabled={
                    provider === "none" ||
                    (provider === "google" && !hasGoogleConnection)
                  }
                  trackColor={{
                    false: palette.borderStrong as string,
                    true: palette.primary as string,
                  }}
                  thumbColor={palette.surfaceElevated as string}
                  ios_backgroundColor={palette.borderStrong as string}
                />
              </View>

              {provider === "google" ? (
                <View
                  style={[
                    styles.infoCard,
                    {
                      borderColor: hasGoogleConnection
                        ? (palette.primary as string)
                        : (palette.border as string),
                      backgroundColor: hasGoogleConnection
                        ? (palette.primarySubtle as string)
                        : (palette.surfaceElevated as string),
                    },
                  ]}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: hasGoogleConnection
                        ? (palette.primary as string)
                        : (palette.textMuted as string),
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {hasGoogleConnection
                      ? t("profile.calendar.googleStateLive", {
                          defaultValue: "Google linked",
                        })
                      : t("profile.calendar.googleStatePending", {
                          defaultValue: "Google pending",
                        })}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: palette.text as string,
                    }}
                  >
                    {hasGoogleConnection
                      ? t("profile.settings.calendar.googleConnectedAs", {
                          email: googleStatus?.accountEmail ?? "Google account",
                        })
                      : t("profile.settings.calendar.googleConnectRequired")}
                  </Text>
                  {connectedDate ? (
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.textMuted as string,
                      }}
                    >
                      {t("profile.settings.calendar.lastConnected", {
                        date: connectedDate,
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {provider === "apple" ? (
                <View
                  style={[
                    styles.infoCard,
                    {
                      borderColor: palette.border as string,
                      backgroundColor: palette.surfaceElevated as string,
                    },
                  ]}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("profile.calendar.appleLabel", {
                      defaultValue: "Apple calendar",
                    })}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: palette.text as string,
                    }}
                  >
                    {t("profile.settings.calendar.applePermissionNote")}
                  </Text>
                </View>
              ) : null}

              {provider === "none" ? (
                <View
                  style={[
                    styles.infoCard,
                    {
                      borderColor: palette.border as string,
                      backgroundColor: palette.surfaceElevated as string,
                    },
                  ]}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("profile.calendar.noneLabel", {
                      defaultValue: "No sync",
                    })}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: palette.text as string,
                    }}
                  >
                    {t("profile.calendar.noneBody", {
                      defaultValue:
                        "Queue will track accepted sessions internally without writing into an external calendar.",
                    })}
                  </Text>
                </View>
              ) : null}

              {googleStatus?.lastError ? (
                <View
                  style={[
                    styles.errorCard,
                    {
                      borderColor: palette.danger as string,
                      backgroundColor: palette.dangerSubtle as string,
                    },
                  ]}
                >
                  <Text
                    style={{
                      ...BrandType.bodyMedium,
                      color: palette.danger as string,
                    }}
                  >
                    {googleStatus.lastError}
                  </Text>
                </View>
              ) : null}

              {provider === "google" ? (
                <View style={{ gap: 10 }}>
                  {!hasGoogleConnection ? (
                    <ActionButton
                      label={
                        isConnectingGoogle
                          ? t("profile.settings.actions.connecting")
                          : t("profile.settings.calendar.actions.connectGoogle")
                      }
                      onPress={() => {
                        void onConnectGoogle();
                      }}
                      disabled={
                        isConnectingGoogle || !googleClientId || !googleRequest
                      }
                      palette={palette}
                      fullWidth
                    />
                  ) : (
                    <>
                      <ActionButton
                        label={
                          isSyncingGoogle
                            ? t("profile.settings.actions.syncing")
                            : t("profile.settings.calendar.actions.syncNow")
                        }
                        onPress={() => {
                          void onSyncGoogleNow();
                        }}
                        disabled={isSyncingGoogle}
                        palette={palette}
                        fullWidth
                      />
                      <ActionButton
                        label={
                          isDisconnectingGoogle
                            ? t("profile.settings.actions.disconnecting")
                            : t("profile.settings.calendar.actions.disconnectGoogle")
                        }
                        onPress={() => {
                          void onDisconnectGoogle();
                        }}
                        disabled={isDisconnectingGoogle}
                        palette={palette}
                        tone="secondary"
                        fullWidth
                      />
                    </>
                  )}
                </View>
              ) : null}
            </View>
          </ProfileSectionCard>
        </View>
      </TabScreenScrollView>

      <View
        style={[
          styles.actionRail,
          {
            bottom: overlayBottom,
            backgroundColor: palette.appBg as string,
          },
        ]}
      >
        <ActionButton
          label={
            isSaving
              ? t("profile.settings.actions.saving")
              : t("profile.settings.actions.save")
          }
          onPress={() => {
            void onSave();
          }}
          disabled={isSaving || !hasChanges}
          palette={palette}
          fullWidth
        />
        <ActionButton
          label={t("common.cancel")}
          onPress={() => router.back()}
          palette={palette}
          tone="secondary"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  heroCard: {
    gap: BrandSpacing.lg,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.xl,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSignalsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sectionBody: {
    padding: BrandSpacing.lg,
    gap: BrandSpacing.md,
  },
  providerBadge: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoCard: {
    gap: 6,
    borderWidth: 1,
    borderRadius: BrandRadius.card - 4,
    borderCurve: "continuous",
    padding: BrandSpacing.lg,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionRail: {
    position: "absolute",
    left: BrandSpacing.lg,
    right: BrandSpacing.lg,
    gap: 10,
  },
});
