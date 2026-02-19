import "expo-dev-client";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useFonts } from "expo-font";
import Constants from "expo-constants";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, LogBox, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";

import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import i18n, { bootstrapLocalization } from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { checkLocationRuntimeSupport } from "@/lib/location-zone";
import { loadThemePreference } from "@/lib/theme-preference";

const IGNORED_LOG_MESSAGES = [
  "ProgressBarAndroid has been extracted from react-native core",
  "SafeAreaView has been deprecated and will be removed",
  "Clipboard has been extracted from react-native core",
  "PushNotificationIOS has been extracted from react-native core",
];

LogBox.ignoreLogs(IGNORED_LOG_MESSAGES);

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const convex = getConvexClient();
  const [fontsLoaded, fontError] = useFonts(MaterialIcons.font);
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const applySavedThemePreference = async () => {
      const { Appearance } = await import("react-native");
      const preference = await loadThemePreference();
      if (!isMounted || !preference) return;
      Appearance.setColorScheme(preference);
    };

    void applySavedThemePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || Constants.appOwnership === "expo") {
      return;
    }

    let cancelled = false;
    const setupNotifications = async () => {
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

    void setupNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    const checkLocationSupport = async () => {
      const support = await checkLocationRuntimeSupport();
      if (cancelled || support.available || support.error?.code !== "native_module_missing") {
        return;
      }

      Alert.alert(
        "Location module unavailable",
        "This build is missing expo-location. Rebuild and reinstall the dev client with `bunx expo run:android`, then relaunch the app.",
      );
    };

    void checkLocationSupport();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setFontLoadTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, 10000);

    return () => {
      clearTimeout(timer);
    };
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(() => {
      if (isMounted) {
        setReady(true);
      }
    }, 8000);

    const run = async () => {
      try {
        const { directionChanged } = await bootstrapLocalization();
        if (directionChanged && Platform.OS !== "web") {
          try {
            const Updates = await import("expo-updates");
            await Updates.reloadAsync();
            return;
          } catch {
            Alert.alert(
              i18n.t("language.restartRequiredTitle"),
              i18n.t("language.restartRequiredMessage"),
            );
          }
        }
      } finally {
        if (isMounted) {
          clearTimeout(timeout);
          setReady(true);
        }
      }
    };

    void run();

    return () => {
      clearTimeout(timeout);
      isMounted = false;
    };
  }, []);

  if (!ready || (!fontsLoaded && !fontError && !fontLoadTimedOut)) {
    return <LoadingScreen />;
  }

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

  const secureStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  };
  const nativeStorage =
    Platform.OS === "android" || Platform.OS === "ios"
      ? secureStorage
      : null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ConvexAuthProvider
          client={convex}
          {...(nativeStorage ? { storage: nativeStorage } : {})}
        >
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
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
              <StatusBar style="auto" translucent={false} />
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
