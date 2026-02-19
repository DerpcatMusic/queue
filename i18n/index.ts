import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { I18nManager, Platform } from "react-native";
import { initReactI18next } from "react-i18next";

import en from "@/i18n/translations/en";
import he from "@/i18n/translations/he";

export const SUPPORTED_LANGUAGES = ["en", "he"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES = new Set<AppLanguage>(["he"]);
const STORAGE_KEY = "queue.language";
const i18n = createInstance();

function isSupportedLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function normalizeLanguage(languageLike?: string | null): AppLanguage {
  if (!languageLike) return "en";
  const base = languageLike.toLowerCase().split("-")[0] ?? "en";
  if (isSupportedLanguage(base)) return base;
  return "en";
}

export function getDeviceLanguage(): AppLanguage {
  const primaryLocale = getLocales()[0]?.languageCode;
  return normalizeLanguage(primaryLocale);
}

export function isRtlLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.has(language);
}

function syncRtlPreference(language: AppLanguage): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  const shouldRtl = isRtlLanguage(language);
  const changed = I18nManager.isRTL !== shouldRtl;
  I18nManager.allowRTL(shouldRtl);
  I18nManager.forceRTL(shouldRtl);
  return changed;
}

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export async function bootstrapLocalization(): Promise<{
  directionChanged: boolean;
}> {
  let savedLanguage: string | null = null;
  try {
    savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    savedLanguage = null;
  }

  if (!savedLanguage) {
    const language = getDeviceLanguage();
    await i18n.changeLanguage(language);
    return { directionChanged: false };
  }

  const language = normalizeLanguage(savedLanguage);
  const directionChanged = syncRtlPreference(language);
  await i18n.changeLanguage(language);
  return { directionChanged };
}

export async function setAppLanguage(
  language: AppLanguage,
): Promise<{ directionChanged: boolean }> {
  const normalized = normalizeLanguage(language);
  const directionChanged = syncRtlPreference(normalized);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Keep language change in-memory even if persistence fails.
  }
  await i18n.changeLanguage(normalized);
  return { directionChanged };
}

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export default i18n;
