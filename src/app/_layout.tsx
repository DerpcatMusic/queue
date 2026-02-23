import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useFonts } from "expo-font";
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
  ThemeProvider,
} from "@react-navigation/native";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  InteractionManager,
  LogBox,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";
import { ThemePreferenceProvider, useThemePreference } from "@/hooks/use-theme-preference";
import i18n, { bootstrapLocalization } from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { recordPerfMetric } from "@/lib/perf-telemetry";

const IGNORED_LOG_MESSAGES = [
  "ProgressBarAndroid has been extracted from react-native core",
  "SafeAreaView has been deprecated and will be removed",
  "Clipboard has been extracted from react-native core",
  "PushNotificationIOS has been extracted from react-native core",
];

LogBox.ignoreLogs(IGNORED_LOG_MESSAGES);

if (__DEV__) {
  try {
    // Avoid resolving dev-client native modules in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constantsModule = require("expo-constants") as {
      default?: { appOwnership?: string };
    };
    if (constantsModule.default?.appOwnership !== "expo") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("expo-dev-client");
    }
  } catch {
    // Optional in runtimes where dev-client is unavailable.
  }
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

type PerformanceWithRnStartupTiming = Performance & {
  rnStartupTiming?: {
    startTime?: number | void;
    executeJavaScriptBundleEntryPointStart?: number | void;
    endTime?: number | void;
  };
};

export const unstable_settings = {
  anchor: "(tabs)",
};

function waitForInteractions() {
  return new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      resolve();
    });
  });
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootLayoutContent />
    </ThemePreferenceProvider>
  );
}

function RootLayoutContent() {
  const { resolvedScheme, stylePreference } = useThemePreference();
  const palette = useBrand();
  const [transitionOverlayColor, setTransitionOverlayColor] = useState(
    palette.appBg as string,
  );
  const convex = getConvexClient();
  useFonts(MaterialIcons.font);
  const transitionOpacity = useMemo(() => new Animated.Value(0), []);
  const currentThemeKey = `${resolvedScheme}:${stylePreference}`;
  const [previousThemeKey, setPreviousThemeKey] = useState(currentThemeKey);
  const [previousBackgroundColor, setPreviousBackgroundColor] = useState(
    palette.appBg as string,
  );

  const nativeStorage = useMemo(() => {
    const secureStorage = {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync,
    };
    return Platform.OS === "android" || Platform.OS === "ios"
      ? secureStorage
      : null;
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
  }, [palette.appBg, palette.border, palette.danger, palette.primary, palette.surface, palette.text, resolvedScheme, stylePreference]);

  useEffect(() => {
    const startupTiming = (performance as PerformanceWithRnStartupTiming)
      .rnStartupTiming;
    if (!startupTiming) return;

    if (
      typeof startupTiming.endTime === "number" &&
      typeof startupTiming.startTime === "number"
    ) {
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
        // Keep this non-blocking: render app shell first, reload only after startup settles.
        try {
          const Updates = await import("expo-updates");
          if (cancelled) return;
          await Updates.reloadAsync();
        } catch {
          if (cancelled) return;
          try {
            Alert.alert(
              i18n.t("language.restartRequiredTitle"),
              i18n.t("language.restartRequiredMessage"),
            );
          } catch {
            // Ignore alert failures in background/teardown conditions.
          }
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
        <ThemedText>
          Missing `EXPO_PUBLIC_CONVEX_URL` in your environment.
        </ThemedText>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ConvexAuthProvider
          client={convex}
          {...(nativeStorage ? { storage: nativeStorage } : {})}
        >
          <ThemeProvider
            value={navigationTheme}
          >
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="modal"
                options={{
                  presentation: "modal",
                  title: i18n.t("modal.headerTitle"),
                }}
              />
            </Stack>
            <StatusBar
              style={resolvedScheme === "dark" ? "light" : "dark"}
              animated
              translucent={false}
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
        </ConvexAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
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
