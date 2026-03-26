import "@/global.css";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

import { BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";
import {
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
  Lexend_900Black,
} from "@expo-google-fonts/lexend";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import { Rubik_400Regular, Rubik_500Medium } from "@expo-google-fonts/rubik";
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
import { useMemo, useState } from "react";
import { LogBox, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppSafeRoot } from "@/components/layout/app-safe-root";
import { AuthSessionControllerProvider } from "@/contexts/auth-session-context";
import { RapydReturnProvider } from "@/contexts/rapyd-return-context";
import { SystemUiProvider, useSystemUi } from "@/contexts/system-ui-context";
import { UserProvider } from "@/contexts/user-context";
import { ThemePreferenceProvider, useThemePreference } from "@/hooks/use-theme-preference";
import i18n from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { useAndroidNavigationBarTheme } from "@/modules/app-shell/use-android-navigation-bar-theme";
import { useLocalizationBootstrapPrompt } from "@/modules/app-shell/use-localization-bootstrap-prompt";
import { useStartupNotificationsSetup } from "@/modules/app-shell/use-startup-notifications-setup";
import { useStartupPerfMetrics } from "@/modules/app-shell/use-startup-perf-metrics";
import { getTheme } from "@/theme/theme";

const IGNORED_LOG_MESSAGES = [
  "ProgressBarAndroid has been extracted from react-native core",
  "SafeAreaView has been deprecated and will be removed",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "Clipboard has been extracted from react-native core",
  "PushNotificationIOS has been extracted from react-native core",
];

LogBox.ignoreLogs(IGNORED_LOG_MESSAGES);

if (Platform.OS === "android") {
  // NavigationBar and StatusBar behavior is largely automatic in SDK 55
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
  const convex = getConvexClient();
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const [fontsLoaded] = useFonts({
    BarlowCondensed_800ExtraBold,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
    Lexend_900Black,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Rubik_400Regular,
    Rubik_500Medium,
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

  const authSessionController = useMemo(
    () => ({
      reloadAuthSession: () => {
        setAuthSessionVersion((currentVersion) => currentVersion + 1);
      },
    }),
    [],
  );

  const themeColors = getTheme(resolvedScheme).color;
  const navColors = useMemo(
    () => ({
      primary: themeColors.primary,
      background: themeColors.appBg,
      card: themeColors.surfaceElevated,
      text: themeColors.text,
      border: themeColors.border,
      notification: themeColors.danger,
    }),
    [themeColors],
  );

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = resolvedScheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: navColors.primary,
        background: navColors.background,
        card: navColors.card,
        text: navColors.text,
        border: navColors.border,
        notification: navColors.notification,
      },
    };
  }, [resolvedScheme, navColors]);

  useStartupPerfMetrics();
  useLocalizationBootstrapPrompt();

  if (!fontsLoaded) {
    return null;
  }

  if (!isConvexUrlConfigured || !convex) {
    return (
      <View className="flex-1 items-center justify-center gap-lg px-xl">
        <Text className="text-title" style={{ color: navColors.text }}>
          {i18n.t("errors.configuration.title")}
        </Text>
        <Text className="font-body text-body" style={{ color: navColors.text }}>
          {i18n.t("errors.configuration.body")}
        </Text>
      </View>
    );
  }

  const statusInsetColor =
    topInsetBackgroundColor ??
    (topInsetTone === "sheet"
      ? navColors.primary
      : topInsetTone === "card"
        ? navColors.card
        : topInsetTone === "app"
          ? navColors.primary
          : navColors.background);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionControllerProvider value={authSessionController}>
        <ConvexAuthProvider
          key={`convex-auth:${authSessionVersion}`}
          client={convex}
          {...(nativeStorage ? { storage: nativeStorage } : {})}
        >
          <UserProvider>
            <RapydReturnProvider>
              <ThemeProvider value={navigationTheme}>
                <AppSafeRoot topInsetBackgroundColor={statusInsetColor}>
                  <View className="flex-1">
                    <Stack
                      screenOptions={{
                        headerTintColor: navColors.text,
                        headerTitleStyle: { color: navColors.text },
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
      </AuthSessionControllerProvider>
    </GestureHandlerRootView>
  );
}
