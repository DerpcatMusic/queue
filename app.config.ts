import type { ExpoConfig } from "expo/config";

const staticConfig = require("./app.json") as { expo: ExpoConfig };

const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveGoogleIosClientId() {
  return trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_IOS);
}

function buildGoogleIosUrlScheme(clientId: string | undefined) {
  if (!clientId || !clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return undefined;
  }

  const clientPrefix = clientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  return clientPrefix ? `com.googleusercontent.apps.${clientPrefix}` : undefined;
}

const googleIosUrlScheme = buildGoogleIosUrlScheme(resolveGoogleIosClientId());
const config = staticConfig.expo;
const plugins = [...(config.plugins ?? [])];
const hasGoogleSigninPlugin = plugins.some(
  (plugin) =>
    plugin === "@react-native-google-signin/google-signin" ||
    (Array.isArray(plugin) && plugin[0] === "@react-native-google-signin/google-signin"),
);

if (googleIosUrlScheme && !hasGoogleSigninPlugin) {
  plugins.push([
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme: googleIosUrlScheme,
    },
  ]);
}

export default {
  ...config,
  plugins,
} satisfies ExpoConfig;
