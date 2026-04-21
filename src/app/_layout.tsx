import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogBox, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetStackProvider } from "@/components";
import { AppSafeRoot } from "@/components/layout/app-safe-root";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { CalendarLessonDetailSheet } from "@/components/sheets/calendar/calendar-lesson-detail-sheet";
import { InstructorAddAccountSheet } from "@/components/sheets/profile/instructor/instructor-add-account-sheet";
import { InstructorCalendarSheet } from "@/components/sheets/profile/instructor/instructor-calendar-sheet";
import { InstructorComplianceSheet } from "@/components/sheets/profile/instructor/instructor-compliance-sheet";
import { InstructorEditSheet } from "@/components/sheets/profile/instructor/instructor-edit-sheet";
import { InstructorLocationSheet } from "@/components/sheets/profile/instructor/instructor-location-sheet";
import { InstructorNotificationsSheet } from "@/components/sheets/profile/instructor/instructor-notifications-sheet";
// Sheet components - mounted at root level above all tabs
import { InstructorPaymentsSheet } from "@/components/sheets/profile/instructor/instructor-payments-sheet";
import { InstructorSportsSheet } from "@/components/sheets/profile/instructor/instructor-sports-sheet";
import { LanguagePickerSheet } from "@/components/sheets/profile/language-picker-sheet";
import { PublicInstructorProfileSheet } from "@/components/sheets/profile/public-instructor-profile-sheet";
import { PublicStudioProfileSheet } from "@/components/sheets/profile/public-studio-profile-sheet";
import { StudioAddAccountSheet } from "@/components/sheets/profile/studio/studio-add-account-sheet";
import { StudioBranchesSheet } from "@/components/sheets/profile/studio/studio-branches-sheet";
import { StudioCalendarSheet } from "@/components/sheets/profile/studio/studio-calendar-sheet";
import { StudioEditSheet } from "@/components/sheets/profile/studio/studio-edit-sheet";
import { StudioNotificationsSheet } from "@/components/sheets/profile/studio/studio-notifications-sheet";
import { StudioPaymentsSheet } from "@/components/sheets/profile/studio/studio-payments-sheet";
import { StudioPublicProfileSheet as StudioPublicProfileSlugSheet } from "@/components/sheets/profile/studio/studio-public-profile-sheet";
import { AuthSessionControllerProvider } from "@/contexts/auth-session-context";
import { SheetProvider, useSheetContext } from "@/contexts/sheet-context";
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
  const { topInsetBackgroundColor, topInsetTone, topInsetVisible } = useSystemUi();
  const { resolvedScheme } = useThemePreference();
  const convex = getConvexClient();
  const [appSessionVersion, setAppSessionVersion] = useState(0);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sessionTransitionCount, setSessionTransitionCount] = useState(0);

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

  // Debounce reloadAuthSession calls to prevent rapid ConvexAuthProvider remounts.
  // Multiple screens (profile, sign-in, etc.) may call reloadAuthSession in quick
  // succession. Each remount triggers a token refresh from the server, which is
  // wasteful and can cause the app to feel sluggish even when idle.
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTransitionTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const authSessionController = useMemo(
    () => ({
      isSessionTransitioning: sessionTransitionCount > 0,
      reloadAuthSession: (immediate = false) => {
        if (immediate) {
          if (reloadDebounceRef.current !== null) {
            clearTimeout(reloadDebounceRef.current);
            reloadDebounceRef.current = null;
          }
          setAuthSessionVersion((v) => v + 1);
          return;
        }
        if (reloadDebounceRef.current !== null) {
          return; // Already scheduled — skip
        }
        reloadDebounceRef.current = setTimeout(() => {
          reloadDebounceRef.current = null;
          setAuthSessionVersion((v) => v + 1);
        }, 500);
      },
      startSessionTransition: (durationMs = 6000) => {
        setSessionTransitionCount((value) => value + 1);
        const timer = setTimeout(() => {
          sessionTransitionTimersRef.current.delete(timer);
          setSessionTransitionCount((value) => Math.max(0, value - 1));
        }, durationMs);
        sessionTransitionTimersRef.current.add(timer);
      },
      restartAppSession: ({
        immediate = true,
        reloadAuth = true,
        transitionMs = 6000,
      }: {
        immediate?: boolean;
        reloadAuth?: boolean;
        transitionMs?: number;
      } = {}) => {
        setSessionTransitionCount((value) => value + 1);
        const timer = setTimeout(() => {
          sessionTransitionTimersRef.current.delete(timer);
          setSessionTransitionCount((value) => Math.max(0, value - 1));
        }, transitionMs);
        sessionTransitionTimersRef.current.add(timer);
        setAppSessionVersion((value) => value + 1);
        if (!reloadAuth) {
          return;
        }
        if (immediate) {
          if (reloadDebounceRef.current !== null) {
            clearTimeout(reloadDebounceRef.current);
            reloadDebounceRef.current = null;
          }
          setAuthSessionVersion((value) => value + 1);
          return;
        }
        if (reloadDebounceRef.current !== null) {
          return;
        }
        reloadDebounceRef.current = setTimeout(() => {
          reloadDebounceRef.current = null;
          setAuthSessionVersion((value) => value + 1);
        }, 500);
      },
    }),
    [sessionTransitionCount],
  );

  useEffect(() => {
    return () => {
      if (reloadDebounceRef.current !== null) {
        clearTimeout(reloadDebounceRef.current);
      }
      for (const timer of sessionTransitionTimersRef.current) {
        clearTimeout(timer);
      }
      sessionTransitionTimersRef.current.clear();
    };
  }, []);

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
      {/* ScrollSheetProvider must be ABOVE BottomSheetModalProvider because
          BottomSheetModal portals render at the BottomSheetModalProvider level.
          If ScrollSheetProvider is below, the portal content loses context. */}
      <ScrollSheetProvider>
        <AuthSessionControllerProvider value={authSessionController}>
          <ConvexAuthProvider
            key={`convex-auth:${authSessionVersion}`}
            client={convex}
            {...(nativeStorage ? { storage: nativeStorage } : {})}
          >
            <UserProvider key={`user-session:${appSessionVersion}`}>
              <BottomSheetStackProvider>
                <SheetProvider key={`sheet-session:${appSessionVersion}`}>
                  <BottomSheetModalProvider>
                    <StartupNotificationsBootstrap />
                    <ThemeProvider value={navigationTheme}>
                      <AppSafeRoot
                        topInsetBackgroundColor={statusInsetColor}
                        rootBackgroundColor={navColors.background}
                        topInsetVisible={topInsetVisible}
                      >
                        <View key={`app-session:${appSessionVersion}`} style={{ flex: 1 }}>
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
                        <StatusBar
                          style={resolvedScheme === "dark" ? "light" : "dark"}
                          animated
                          {...(Platform.OS === "android" && !topInsetVisible
                            ? { translucent: true, backgroundColor: "transparent" }
                            : {})}
                        />
                      </AppSafeRoot>
                    </ThemeProvider>
                    {/* Sheets use BottomSheetModal portals — position absolute so they never
                        take flex layout space alongside the main app. */}
                    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0 }}>
                      <GlobalSheets />
                    </View>
                  </BottomSheetModalProvider>
                </SheetProvider>
              </BottomSheetStackProvider>
            </UserProvider>
          </ConvexAuthProvider>
        </AuthSessionControllerProvider>
      </ScrollSheetProvider>
    </GestureHandlerRootView>
  );
}

// Component that renders all sheets at the root level
// Sheets get their onClose from SheetContext internally
function GlobalSheets() {
  const {
    instructorActiveSheet,
    studioActiveSheet,
    closeInstructorSheet,
    closeStudioSheet,
    calendarLessonJobId,
    calendarLessonRole,
    closeCalendarLesson,
    studioPublicProfileSlug,
    closeStudioPublicProfile,
    instructorPublicProfileId,
    closeInstructorPublicProfile,
    studioPublicProfileId,
    closeStudioPublicProfileById,
    languagePickerVisible,
    closeLanguagePicker,
  } = useSheetContext();

  const closeInstructorSheetIfActive = useCallback(
    (sheet: NonNullable<typeof instructorActiveSheet>) => () => {
      if (instructorActiveSheet === sheet) {
        closeInstructorSheet();
      }
    },
    [closeInstructorSheet, instructorActiveSheet],
  );

  const closeStudioSheetIfActive = useCallback(
    (sheet: NonNullable<typeof studioActiveSheet>) => () => {
      if (studioActiveSheet === sheet) {
        closeStudioSheet();
      }
    },
    [closeStudioSheet, studioActiveSheet],
  );

  return (
    <>
      {/* Instructor sheets */}
      {instructorActiveSheet === "payments" ? (
        <InstructorPaymentsSheet visible onClose={closeInstructorSheetIfActive("payments")} />
      ) : null}
      {instructorActiveSheet === "sports" ? (
        <InstructorSportsSheet visible onClose={closeInstructorSheetIfActive("sports")} />
      ) : null}
      {instructorActiveSheet === "location" ? (
        <InstructorLocationSheet visible onClose={closeInstructorSheetIfActive("location")} />
      ) : null}
      {instructorActiveSheet === "compliance" ? (
        <InstructorComplianceSheet visible onClose={closeInstructorSheetIfActive("compliance")} />
      ) : null}
      {instructorActiveSheet === "calendar-settings" ? (
        <InstructorCalendarSheet
          visible
          onClose={closeInstructorSheetIfActive("calendar-settings")}
        />
      ) : null}
      {instructorActiveSheet === "edit" ? (
        <InstructorEditSheet visible onClose={closeInstructorSheetIfActive("edit")} />
      ) : null}
      {instructorActiveSheet === "notifications" ? (
        <InstructorNotificationsSheet
          visible
          onClose={closeInstructorSheetIfActive("notifications")}
        />
      ) : null}
      {instructorActiveSheet === "add-account" ? (
        <InstructorAddAccountSheet visible onClose={closeInstructorSheetIfActive("add-account")} />
      ) : null}
      {/* Studio sheets */}
      {studioActiveSheet === "payments" ? (
        <StudioPaymentsSheet visible onClose={closeStudioSheetIfActive("payments")} />
      ) : null}
      {studioActiveSheet === "branches" ? (
        <StudioBranchesSheet visible onClose={closeStudioSheetIfActive("branches")} />
      ) : null}
      {studioActiveSheet === "calendar-settings" ? (
        <StudioCalendarSheet visible onClose={closeStudioSheetIfActive("calendar-settings")} />
      ) : null}
      {studioActiveSheet === "edit" ? (
        <StudioEditSheet visible onClose={closeStudioSheetIfActive("edit")} />
      ) : null}
      {studioActiveSheet === "notifications" ? (
        <StudioNotificationsSheet visible onClose={closeStudioSheetIfActive("notifications")} />
      ) : null}
      {studioActiveSheet === "add-account" ? (
        <StudioAddAccountSheet visible onClose={closeStudioSheetIfActive("add-account")} />
      ) : null}

      {/* Calendar lesson detail sheet */}
      {calendarLessonJobId !== null ? (
        <CalendarLessonDetailSheet
          visible
          jobId={calendarLessonJobId}
          role={calendarLessonRole}
          onClose={closeCalendarLesson}
        />
      ) : null}

      {/* Studio public profile sheet */}
      {studioPublicProfileSlug !== null ? (
        <StudioPublicProfileSlugSheet
          visible
          slug={studioPublicProfileSlug}
          onClose={closeStudioPublicProfile}
        />
      ) : null}
      {instructorPublicProfileId !== null ? (
        <PublicInstructorProfileSheet
          visible
          instructorId={instructorPublicProfileId}
          onClose={closeInstructorPublicProfile}
        />
      ) : null}
      {studioPublicProfileId !== null ? (
        <PublicStudioProfileSheet
          visible
          studioId={studioPublicProfileId}
          onClose={closeStudioPublicProfileById}
        />
      ) : null}
      {languagePickerVisible ? <LanguagePickerSheet visible onClose={closeLanguagePicker} /> : null}
    </>
  );
}
