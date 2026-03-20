import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";
import i18n from "@/i18n";

const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";
const FALLBACK_REDIRECT_PATH = "/oauth/google-calendar";

export type GoogleCalendarAuthConfig = {
  mode: "native_android" | "oauth_session";
  clientId?: string;
  serverClientId?: string;
  redirectUri: string;
  configError?: string;
};

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getPlatformClientId(platform: string) {
  if (platform === "ios") {
    return trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_IOS);
  }
  if (platform === "android") {
    return trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_ANDROID);
  }
  return trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_WEB);
}

function getServerClientId() {
  return trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_SERVER_CLIENT_ID);
}

function buildIosClientRedirectUri(clientId: string) {
  if (!clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return undefined;
  }

  const clientPrefix = clientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  if (!clientPrefix) {
    return undefined;
  }

  return `com.googleusercontent.apps.${clientPrefix}:${FALLBACK_REDIRECT_PATH}`;
}

function buildFallbackRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: "queue",
    path: "oauth/google-calendar",
  });
}

function describeClientIdEnv(platform: string) {
  if (platform === "ios") {
    return "EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_IOS";
  }
  if (platform === "android") {
    return "EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_ANDROID";
  }
  return "EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_WEB";
}

function validateRedirectUri(platform: string, redirectUri: string) {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return i18n.t("profile.calendar.configErrors.invalidRedirectUri");
  }

  const scheme = parsed.protocol.slice(0, -1);
  if (!scheme) {
    return i18n.t("profile.calendar.configErrors.missingScheme");
  }

  if (platform === "android" && scheme !== "https") {
    return i18n.t("profile.calendar.configErrors.androidHttpsRequired");
  }

  if (scheme !== "https" && !scheme.includes(".")) {
    return i18n.t("profile.calendar.configErrors.invalidRedirectScheme", {
      scheme,
    });
  }

  return undefined;
}

export function resolveGoogleCalendarAuthConfig(
  platform: string = Platform.OS,
): GoogleCalendarAuthConfig {
  if (platform === "android") {
    const serverClientId = getServerClientId();
    return {
      mode: "native_android",
      redirectUri:
        trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_REDIRECT_URL) ??
        "https://join-queue.com/oauth/google-calendar",
      ...(serverClientId
        ? { serverClientId }
        : {
            configError: i18n.t("profile.calendar.configErrors.missingServerClientId"),
          }),
    };
  }

  const clientId = getPlatformClientId(platform);
  if (!clientId) {
    return {
      mode: "oauth_session",
      redirectUri: buildFallbackRedirectUri(),
      configError: i18n.t("profile.calendar.configErrors.missingClientId", {
        env: describeClientIdEnv(platform),
      }),
    };
  }

  const explicitRedirectUri = trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_REDIRECT_URL);
  const redirectUri =
    explicitRedirectUri ??
    (platform === "ios" ? buildIosClientRedirectUri(clientId) : undefined) ??
    buildFallbackRedirectUri();
  const configError = validateRedirectUri(platform, redirectUri);

  const config: GoogleCalendarAuthConfig = {
    mode: "oauth_session",
    clientId,
    redirectUri,
  };

  if (configError) {
    config.configError = configError;
  }

  return config;
}
