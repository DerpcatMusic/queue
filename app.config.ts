import type { ExpoConfig } from "expo/config";

const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveMapboxPublicToken() {
  return (
    trimEnv(process.env.EXPO_PUBLIC_MAPBOX_TOKEN) ??
    trimEnv(process.env.MAPBOX_PUBLIC_TOKEN) ??
    trimEnv(process.env.MAPBOX_TOKEN)
  );
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

export default ({ config }: { config: ExpoConfig }) => {
  const easProjectId =
    trimEnv(process.env.EXPO_PUBLIC_EAS_PROJECT_ID) ?? trimEnv(process.env.EAS_PROJECT_ID);
  const mapboxPublicToken = resolveMapboxPublicToken();
  const plugins = [...(config.plugins ?? [])];
  const hasGoogleSigninPlugin = plugins.some(
    (plugin) =>
      plugin === "@react-native-google-signin/google-signin" ||
      (Array.isArray(plugin) && plugin[0] === "@react-native-google-signin/google-signin"),
  );
  const hasStripePlugin = plugins.some(
    (plugin) =>
      plugin === "@stripe/stripe-react-native" ||
      (Array.isArray(plugin) && plugin[0] === "@stripe/stripe-react-native"),
  );
  const hasAppleAuthPlugin = plugins.some(
    (plugin) =>
      plugin === "expo-apple-authentication" ||
      (Array.isArray(plugin) && plugin[0] === "expo-apple-authentication"),
  );
  const hasDiditPlugin = plugins.some(
    (plugin) =>
      plugin === "@didit-protocol/sdk-react-native" ||
      (Array.isArray(plugin) && plugin[0] === "@didit-protocol/sdk-react-native"),
  );
  const hasExpoImagePlugin = plugins.some(
    (plugin) => plugin === "expo-image" || (Array.isArray(plugin) && plugin[0] === "expo-image"),
  );

  if (googleIosUrlScheme && !hasGoogleSigninPlugin) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: googleIosUrlScheme,
      },
    ]);
  }

  if (!hasStripePlugin) {
    plugins.push([
      "@stripe/stripe-react-native",
      {},
    ]);
  }

  if (!hasAppleAuthPlugin) {
    plugins.push("expo-apple-authentication");
  }

  if (!hasDiditPlugin) {
    plugins.push([
      "@didit-protocol/sdk-react-native",
      {},
    ]);
  }

  if (!hasExpoImagePlugin) {
    plugins.push("expo-image");
  }

  return {
    ...config,
    ios: {
      ...(config.ios ?? {}),
      usesAppleSignIn: true,
    },
    plugins,
    extra: {
      ...(config.extra ?? {}),
      ...(mapboxPublicToken
        ? {
            mapboxPublicToken,
            EXPO_PUBLIC_MAPBOX_TOKEN: mapboxPublicToken,
          }
        : {}),
      ...(easProjectId
        ? {
            eas: {
              ...(((config.extra ?? {}).eas as Record<string, unknown> | undefined) ?? {}),
              projectId: easProjectId,
            },
          }
        : {}),
    },
  } satisfies ExpoConfig;
};
