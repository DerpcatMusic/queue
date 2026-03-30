import type { ExpoConfig } from "expo/config";

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

export default ({ config }: { config: ExpoConfig }) => {
  const easProjectId =
    trimEnv(process.env.EXPO_PUBLIC_EAS_PROJECT_ID) ?? trimEnv(process.env.EAS_PROJECT_ID);
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

  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra ?? {}),
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
