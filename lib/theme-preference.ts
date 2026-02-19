import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

const THEME_PREFERENCE_KEY = "app_theme_preference";

export type ThemePreference = "light" | "dark";

function toThemePreference(
  value: string | null,
): ThemePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return toThemePreference(stored);
  } catch {
    return null;
  }
}

export async function setThemePreference(
  preference: ThemePreference,
): Promise<void> {
  Appearance.setColorScheme(preference);
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Ignore persistence failures and keep runtime theme change.
  }
}
