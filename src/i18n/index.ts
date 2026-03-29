import { MMKV } from "react-native-mmkv";
import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";

import en from "@/i18n/translations/en";
import he from "@/i18n/translations/he";

export const SUPPORTED_LANGUAGES = ["en", "he"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES = new Set<AppLanguage>(["he"]);
const STORAGE_KEY = "queue.language";
const storage = new MMKV({ id: "app-storage" });
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

function getDeviceLanguage(): AppLanguage {
  const primaryLocale = getLocales()[0]?.languageCode;
  return normalizeLanguage(primaryLocale);
}

function isRtlLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.has(language);
}

function syncRtlPreference(language: AppLanguage): boolean {
  const shouldRtl = isRtlLanguage(language);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.dir = shouldRtl ? "rtl" : "ltr";
      document.documentElement.lang = language;
    }
    return false;
  }

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

export function bootstrapLocalization(): {
  directionChanged: boolean;
} {
  let savedLanguage: string | null = null;
  try {
    savedLanguage = storage.getString(STORAGE_KEY) ?? null;
  } catch {
    savedLanguage = null;
  }

  const language = savedLanguage ? normalizeLanguage(savedLanguage) : getDeviceLanguage();
  const directionChanged = syncRtlPreference(language);
  i18n.changeLanguage(language);
  return { directionChanged };
}

export function setAppLanguage(
  language: AppLanguage,
): { directionChanged: boolean } {
  const normalized = normalizeLanguage(language);
  const directionChanged = syncRtlPreference(normalized);
  try {
    storage.set(STORAGE_KEY, normalized);
  } catch {
    // Keep language change in-memory even if persistence fails.
  }
  i18n.changeLanguage(normalized);
  return { directionChanged };
}

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export default i18n;
