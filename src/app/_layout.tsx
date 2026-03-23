import "@/global.css";
import { BrandSpacing } from "@/constants/brand";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppSafeRoot } from "@/components/layout/app-safe-root";
import { ThemedText } from "@/components/themed-text";
import { RapydReturnProvider } from "@/contexts/rapyd-return-context";
import { SystemUiProvider, useSystemUi } from "@/contexts/system-ui-context";
import { UserProvider } from "@/contexts/user-context";
import { useBrand } from "@/hooks/use-brand";
import { ThemePreferenceProvider, useThemePreference } from "@/hooks/use-theme-preference";
import i18n from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { useAndroidNavigationBarTheme } from "@/modules/app-shell/use-android-navigation-bar-theme";
import { useLocalizationBootstrapPrompt } from "@/modules/app-shell/use-localization-bootstrap-prompt";
import { useStartupNotificationsSetup } from "@/modules/app-shell/use-startup-notifications-setup";
import { useStartupPerfMetrics } from "@/modules/app-shell/use-startup-perf-metrics";

const IGNORED_LOG_MESSAGES = [
  "ProgressBarAndroid has been extracted from react-native core",
  "SafeAreaView has been deprecated and will be removed",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "Clipboard has been extracted from react-native core",
  "PushNotificationIOS has been extracted from react-native core",
];

LogBox.ignoreLogs(IGNORED_LOG_MESSAGES);

// Global edge-to-edge configuration for Expo 55+
if (Platform.OS === "android") {
  // NavigationBar and StatusBar behavior is largely automatic in SDK 55
  // but we can ensure standard behavior here if needed.
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export const unstable_settings = {
  anchor: "(app)",
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <SystemUiProvider>
          <RootLayoutContent />
        </SystemUiProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const { topInsetBackgroundColor, topInsetTone } = useSystemUi();
  const { resolvedScheme } = useThemePreference();
  const palette = useBrand();
  const convex = getConvexClient();
  useFonts({
    ...MaterialIcons.font,
    BarlowCondensed_800ExtraBold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  const nativeStorage = useMemo(() => {
    const secureStorage = {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync,
    };
    return Platform.OS === "android" || Platform.OS === "ios" ? secureStorage : null;
  }, []);

  useStartupNotificationsSetup();

  useAndroidNavigationBarTheme(resolvedScheme);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = resolvedScheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary as string,
        background: palette.appBg as string,
        card: palette.surface as string,
        text: palette.text as string,
        border: palette.border as string,
        notification: palette.danger as string,
      },
    };
  }, [
    palette.appBg,
    palette.border,
    palette.danger,
    palette.primary,
    palette.surface,
    palette.text,
    resolvedScheme,
  ]);

  useStartupPerfMetrics();
  useLocalizationBootstrapPrompt();

  if (!isConvexUrlConfigured || !convex) {
    return (
      <View className="flex-1 items-center justify-center" style={{ gap: BrandSpacing.lg, paddingHorizontal: BrandSpacing.xl }}>
        <ThemedText type="title">{i18n.t("errors.configuration.title")}</ThemedText>
        <ThemedText>{i18n.t("errors.configuration.body")}</ThemedText>
      </View>
    );
  }

  const fallbackBackgroundColor =
    topInsetTone === "sheet"
      ? palette.primary
      : topInsetTone === "card"
        ? palette.surface
        : topInsetTone === "transparent"
          ? "transparent"
          : topInsetTone === "app"
            ? palette.primary
            : palette.appBg;
  const statusInsetColor = topInsetBackgroundColor ?? fallbackBackgroundColor;

  return (
    <GestureHandlerRootView className="flex-1">
      <ConvexAuthProvider client={convex} {...(nativeStorage ? { storage: nativeStorage } : {})}>
        <UserProvider>
          <RapydReturnProvider>
            <ThemeProvider value={navigationTheme}>
              <AppSafeRoot topInsetBackgroundColor={statusInsetColor}>
                <View className="flex-1">
                  <Stack
                    screenOptions={{
                      headerTintColor: palette.text as string,
                      headerTitleStyle: { color: palette.text as string },
                    }}
                  >
                    <Stack.Screen
                      name="index"
                      options={{
                        headerShown: false,
                        animation: "none",
                      }}
                    />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="modal"
                      options={{
                        presentation: "modal",
                        title: i18n.t("modal.headerTitle"),
                      }}
                    />
                  </Stack>
                </View>
              </AppSafeRoot>
              <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} animated />
            </ThemeProvider>
          </RapydReturnProvider>
        </UserProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}
