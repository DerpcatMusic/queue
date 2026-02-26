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
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  LogBox,
  StatusBar as NativeStatusBar,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { SystemUiProvider, useSystemUi } from "@/contexts/system-ui-context";
import { UserProvider } from "@/contexts/user-context";
import { useBrand } from "@/hooks/use-brand";
import { ThemePreferenceProvider, useThemePreference } from "@/hooks/use-theme-preference";
import i18n, { bootstrapLocalization } from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { recordPerfMetric } from "@/lib/perf-telemetry";

type ExpoNavigationBarModule = typeof import("expo-navigation-bar");

const NavigationBarModule: ExpoNavigationBarModule | null = (() => {
  try {
    // Resolve once at startup; if native module is missing we gracefully skip nav-bar theming.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-navigation-bar") as ExpoNavigationBarModule;
  } catch {
    return null;
  }
})();

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

type PerformanceWithRnStartupTiming = Performance & {
  rnStartupTiming?: {
    startTime?: number | undefined;
    executeJavaScriptBundleEntryPointStart?: number | undefined;
    endTime?: number | undefined;
  };
};

export const unstable_settings = {
  anchor: "(tabs)",
};

function waitForInteractions() {
  return new Promise<void>((resolve) => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(() => resolve(), { timeout: 1200 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

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

function isActivityUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("current activity is no longer available") ||
    error.message.includes("current activity is not available")
  );
}

function RootLayoutContent() {
  const insets = useSafeAreaInsets();
  const { topInsetBackgroundColor } = useSystemUi();
  const { resolvedScheme, stylePreference } = useThemePreference();
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
  const currentThemeKey = `${resolvedScheme}:${stylePreference}`;
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

  useEffect(() => {
    if (Platform.OS === "web" || Constants.appOwnership === "expo") {
      return;
    }

    let cancelled = false;
    const setupNotificationsAfterInteractions = async () => {
      await waitForInteractions();
      if (cancelled) return;
      try {
        const Notifications = await import("expo-notifications");
        if (cancelled) return;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      } catch {
        // Notifications are optional in environments where module/runtime support is unavailable.
      }
    };

    void setupNotificationsAfterInteractions();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (Platform.OS !== "android" || !NavigationBarModule) {
      return;
    }

    let cancelled = false;
    const buttonStyle = resolvedScheme === "dark" ? "light" : "dark";

    const applyAndroidNavigationBarTheme = async () => {
      if (cancelled || AppState.currentState !== "active") {
        return;
      }

      try {
        await NavigationBarModule.setButtonStyleAsync(buttonStyle);
      } catch (error) {
        if (isActivityUnavailableError(error)) {
          return;
        }
        // Ignore unsupported configuration on devices/OS modes where nav styling is limited.
      }
    };

    void applyAndroidNavigationBarTheme();
    return () => {
      cancelled = true;
    };
  }, [resolvedScheme]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = resolvedScheme === "dark" ? DarkTheme : DefaultTheme;
    if (stylePreference === "native") {
      return base;
    }
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
    stylePreference,
  ]);

  useEffect(() => {
    const startupTiming = (performance as PerformanceWithRnStartupTiming).rnStartupTiming;
    if (!startupTiming) return;

    if (typeof startupTiming.endTime === "number" && typeof startupTiming.startTime === "number") {
      recordPerfMetric(
        "app.native_startup_runtime",
        startupTiming.endTime - startupTiming.startTime,
      );
    }
    if (
      typeof startupTiming.endTime === "number" &&
      typeof startupTiming.executeJavaScriptBundleEntryPointStart === "number"
    ) {
      recordPerfMetric(
        "app.native_startup_js_bundle",
        startupTiming.endTime - startupTiming.executeJavaScriptBundleEntryPointStart,
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { directionChanged } = await bootstrapLocalization();
        if (cancelled || !directionChanged || Platform.OS === "web") {
          return;
        }
        await waitForInteractions();
        if (cancelled) return;
        // Avoid forced runtime reload at startup; ask for manual restart instead.
        try {
          Alert.alert(
            i18n.t("language.restartRequiredTitle"),
            i18n.t("language.restartRequiredMessage"),
          );
        } catch {
          // Ignore alert failures in background/teardown conditions.
        }
      } catch {
        // Keep boot resilient if localization bootstrap fails.
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isConvexUrlConfigured || !convex) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText type="title">Configuration Error</ThemedText>
        <ThemedText>Missing `EXPO_PUBLIC_CONVEX_URL` in your environment.</ThemedText>
      </View>
    );
  }

  const fallbackBackgroundColor = palette.appBg;
  const statusInsetColor = topInsetBackgroundColor ?? fallbackBackgroundColor;
  const topInsetHeight = Math.max(
    insets.top,
    Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 0) : 0,
  );
  const statusBarBackgroundColor =
    typeof statusInsetColor === "string" ? statusInsetColor : undefined;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ConvexAuthProvider client={convex} {...(nativeStorage ? { storage: nativeStorage } : {})}>
        <UserProvider>
          <ThemeProvider value={navigationTheme}>
            <View style={styles.root}>
              <View
                pointerEvents="none"
                style={[
                  styles.topInsetFill,
                  { height: topInsetHeight, backgroundColor: statusInsetColor },
                ]}
              />
              <View style={[styles.stackContainer, { marginTop: topInsetHeight }]}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            </View>
            <StatusBar
              style={resolvedScheme === "dark" ? "light" : "dark"}
              animated
              translucent
              {...(statusBarBackgroundColor ? { backgroundColor: statusBarBackgroundColor } : {})}
            />
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
  topInsetFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
});
