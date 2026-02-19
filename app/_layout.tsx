import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ConvexProviderWithClerk } from "convex/react-clerk";
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

import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import i18n, { bootstrapLocalization } from "@/i18n";
import { getConvexClient, isConvexUrlConfigured } from "@/lib/convex";
import { loadThemePreference } from "@/lib/theme-preference";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
    LogBox.ignoreLogs([
      "Clerk: Clerk has been loaded with development keys.",
      "ProgressBarAndroid has been extracted from react-native core",
      "SafeAreaView has been deprecated and will be removed",
      "Clipboard has been extracted from react-native core",
      "PushNotificationIOS has been extracted from react-native core",
    ]);
  }, []);

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

  if (!clerkPublishableKey) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText type="title">Configuration Error</ThemedText>
        <ThemedText>
          Missing `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in your environment.
        </ThemedText>
      </View>
    );
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

  const nativeClerkProviderProps =
    Platform.OS === "web" || !tokenCache
      ? {}
      : {
          tokenCache,
        };

  return (
    <GestureHandlerRootView style={styles.root}>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        {...nativeClerkProviderProps}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
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
        </ConvexProviderWithClerk>
      </ClerkProvider>
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
