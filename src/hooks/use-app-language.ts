import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

import i18n, {
  getCurrentLanguage,
  normalizeLanguage,
  setAppLanguage,
} from "@/i18n";
import type { AppLanguage } from "@/i18n";

export function useAppLanguage() {
  const [language, setLanguageState] =
    useState<AppLanguage>(getCurrentLanguage());

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLanguageState(normalizeLanguage(nextLanguage));
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    const { directionChanged } = await setAppLanguage(nextLanguage);

    if (!directionChanged) return;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }

    try {
      const Updates = await import("expo-updates");
      await Updates.reloadAsync();
    } catch {
      Alert.alert(
        i18n.t("language.restartRequiredTitle"),
        i18n.t("language.restartRequiredMessage"),
      );
    }
  }, []);

  return { language, setLanguage };
}
