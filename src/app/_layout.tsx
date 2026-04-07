import { ConvexAuthProvider } from "@convex-dev/auth/react";

import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { loadAsync } from "expo-font";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { LogBox, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppSafeRoot } from "@/components/layout/app-safe-root";
import { AuthSessionControllerProvider } from "@/contexts/auth-session-context";
import { SystemUiProvider, useSystemUi } from "@/contexts/system-ui-context";
import { UserProvider } from "@/contexts/user-context";
import { ThemePreferenceProvider, useThemePreference } from "@/hooks/use-theme-preference";
import i18n from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { StartupNotificationsBootstrap } from "@/modules/app-shell/startup-notifications-bootstrap";
import { useAndroidNavigationBarTheme } from "@/modules/app-shell/use-android-navigation-bar-theme";
import { useLocalizationBootstrapPrompt } from "@/modules/app-shell/use-localization-bootstrap-prompt";
import { useStartupPerfMetrics } from "@/modules/app-shell/use-startup-perf-metrics";
import { BrandSpacing, BrandType, getTheme } from "@/theme/theme";

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
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load Google Fonts asynchronously to avoid blocking app startup.
  // Using loadAsync with dynamic imports instead of useFonts with
  // static imports to enable code-splitting of font packages.
  useEffect(() => {
    let isMounted = true;

    const loadFonts = async () => {
      // Prevent splash screen from hiding while fonts load to avoid blank flash
      await SplashScreen.preventAutoHideAsync();

      try {
        const [barlow, kanit, lexend, manrope, rubik] = await Promise.all([
          import("@expo-google-fonts/barlow-condensed"),
          import("@expo-google-fonts/kanit"),
          import("@expo-google-fonts/lexend"),
          import("@expo-google-fonts/manrope"),
          import("@expo-google-fonts/rubik"),
        ]);
        await loadAsync({
          BarlowCondensed_800ExtraBold: barlow.BarlowCondensed_800ExtraBold,
          Kanit_600SemiBold: kanit.Kanit_600SemiBold,
          Kanit_700Bold: kanit.Kanit_700Bold,
          Kanit_800ExtraBold: kanit.Kanit_800ExtraBold,
          Lexend_500Medium: lexend.Lexend_500Medium,
          Lexend_600SemiBold: lexend.Lexend_600SemiBold,
          Lexend_700Bold: lexend.Lexend_700Bold,
          Lexend_800ExtraBold: lexend.Lexend_800ExtraBold,
          Manrope_400Regular: manrope.Manrope_400Regular,
          Manrope_500Medium: manrope.Manrope_500Medium,
          Manrope_600SemiBold: manrope.Manrope_600SemiBold,
          Rubik_400Regular: rubik.Rubik_400Regular,
          Rubik_500Medium: rubik.Rubik_500Medium,
        });
        if (isMounted) {
          setFontsLoaded(true);
          await SplashScreen.hideAsync();
        }
      } catch (error) {
        // Fonts failed to load - app will use system fonts as fallback
        console.warn("Failed to load custom fonts:", error);
        if (isMounted) {
          setFontsLoaded(true);
          await SplashScreen.hideAsync();
        }
      }
    };
    void loadFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  const nativeStorage = useMemo(() => {
    const secureStorage = {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync,
    };
    return Platform.OS === "android" || Platform.OS === "ios" ? secureStorage : null;
  }, []);

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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: BrandSpacing.lg,
          paddingHorizontal: BrandSpacing.xl,
        }}
      >
        <Text style={[BrandType.title, { color: navColors.text, textAlign: "center" }]}>
          {i18n.t("errors.configuration.title")}
        </Text>
        <Text style={[BrandType.body, { color: navColors.text, textAlign: "center" }]}>
          {i18n.t("errors.configuration.body")}
        </Text>
      </View>
    );
  }

  const statusInsetColor =
    topInsetBackgroundColor ??
    (topInsetTone === "sheet"
      ? navColors.card
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
            <StartupNotificationsBootstrap />
            <ThemeProvider value={navigationTheme}>
              <AppSafeRoot topInsetBackgroundColor={statusInsetColor}>
                <View style={{ flex: 1 }}>
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
                <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} animated />
              </AppSafeRoot>
            </ThemeProvider>
          </UserProvider>
        </ConvexAuthProvider>
      </AuthSessionControllerProvider>
    </GestureHandlerRootView>
  );
}
