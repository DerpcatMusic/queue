import { useEffect } from "react";
import { AppState, Platform } from "react-native";

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

function isActivityUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("current activity is no longer available") ||
    error.message.includes("current activity is not available")
  );
}

export function useAndroidNavigationBarTheme(resolvedScheme: string) {
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
}
