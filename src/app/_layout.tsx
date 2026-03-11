import { ConvexAuthProvider } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFonts } from "expo-font";
import "../../global.css";
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from "@expo-google-fonts/barlow-condensed";
import {
  Rubik_300Light,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  Rubik_800ExtraBold,
  Rubik_900Black,
} from "@expo-google-fonts/rubik";
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Animated, LogBox, Platform, StyleSheet, View } from "react-native";
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
  const [transitionOverlayColor, setTransitionOverlayColor] = useState(palette.appBg as string);
  const convex = getConvexClient();
  useFonts({
    ...MaterialIcons.font,
    // Sekuya — sporty display font (local TTF asset)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    "Sekuya-Regular": require("../../assets/fonts/Sekuya-Regular.ttf"),
    // Barlow Condensed — sporty condensed for headings/titles
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_900Black,
    // Rubik — Hebrew-safe body/caption font (all weights)
    Rubik_300Light,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Rubik_900Black,
  });
  const transitionOpacity = useMemo(() => new Animated.Value(0), []);
  const currentThemeKey = resolvedScheme;
  const [previousThemeKey, setPreviousThemeKey] = useState(currentThemeKey);
  const [previousBackgroundColor, setPreviousBackgroundColor] = useState(palette.appBg as string);

  const nativeStorage = useMemo(() => {
    const secureStorage = {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync,
    };
    return Platform.OS === "android" || Platform.OS === "ios" ? secureStorage : null;
  }, []);

  useStartupNotificationsSetup();

  useEffect(() => {
    if (previousThemeKey === currentThemeKey) {
      return;
    }

    setTransitionOverlayColor(previousBackgroundColor);
    transitionOpacity.setValue(1);
    Animated.timing(transitionOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    setPreviousBackgroundColor(palette.appBg as string);
    setPreviousThemeKey(currentThemeKey);
  }, [
    currentThemeKey,
    palette.appBg,
    previousBackgroundColor,
    previousThemeKey,
    transitionOpacity,
  ]);

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
      <View style={styles.errorContainer}>
        <ThemedText type="title">{i18n.t("errors.configuration.title")}</ThemedText>
        <ThemedText>{i18n.t("errors.configuration.body")}</ThemedText>
      </View>
    );
  }

  const fallbackBackgroundColor =
    topInsetTone === "sheet"
      ? palette.surfaceAlt
      : topInsetTone === "card"
        ? palette.surface
        : topInsetTone === "transparent"
          ? "transparent"
          : palette.appBg;
  const statusInsetColor = topInsetBackgroundColor ?? fallbackBackgroundColor;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ConvexAuthProvider client={convex} {...(nativeStorage ? { storage: nativeStorage } : {})}>
        <UserProvider>
          <RapydReturnProvider>
            <ThemeProvider value={navigationTheme}>
              <AppSafeRoot topInsetBackgroundColor={statusInsetColor}>
                <View style={styles.stackContainer}>
                  <Stack
                    screenOptions={{
                      headerTintColor: palette.text as string,
                      headerTitleStyle: { color: palette.text as string },
                    }}
                  >
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
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: transitionOverlayColor,
                    opacity: transitionOpacity,
                  },
                ]}
              />
            </ThemeProvider>
          </RapydReturnProvider>
        </UserProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stackContainer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
});
