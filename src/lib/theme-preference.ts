import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

const THEME_PREFERENCE_KEY = "app_theme_preference";
const THEME_STYLE_PREFERENCE_KEY = "app_theme_style_preference";

export type ThemePreference = "light" | "dark" | "system";
export type ThemeStylePreference = "native" | "custom";

function toThemePreference(
  value: string | null,
): ThemePreference | null {
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

function toThemeStylePreference(
  value: string | null,
): ThemeStylePreference | null {
  return value === "native" || value === "custom" ? value : null;
}

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return toThemePreference(stored);
  } catch {
    return null;
  }
}

export async function loadThemeStylePreference(): Promise<ThemeStylePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STYLE_PREFERENCE_KEY);
    return toThemeStylePreference(stored);
  } catch {
    return null;
  }
}

export async function persistThemePreference(
  preference: ThemePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Ignore persistence failures
  }
}

export async function persistThemeStylePreference(
  preference: ThemeStylePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STYLE_PREFERENCE_KEY, preference);
  } catch {
    // Ignore persistence failures
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  const setColorScheme = (
    Appearance as {
      setColorScheme?: (scheme: "light" | "dark" | "unspecified" | null) => void;
    }
  ).setColorScheme;

  if (typeof setColorScheme !== "function") {
    return;
  }

  setColorScheme(preference === "system" ? "unspecified" : preference);
}

export async function setThemePreference(
  preference: ThemePreference,
): Promise<void> {
  await persistThemePreference(preference);
  applyThemePreference(preference);
}
