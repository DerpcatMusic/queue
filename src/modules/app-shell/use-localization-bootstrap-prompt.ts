import { useEffect } from "react";
import { Alert, Platform } from "react-native";

import i18n, { bootstrapLocalization } from "@/i18n";
import { waitForInteractions } from "@/modules/app-shell/wait-for-interactions";

export function useLocalizationBootstrapPrompt() {
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
        // Avoid forced runtime reload at startup; ask for manual restart instead.
        try {
          Alert.alert(
            i18n.t("language.restartRequiredTitle"),
            i18n.t("language.restartRequiredMessage"),
          );
        } catch {
          // Ignore alert failures in background/teardown conditions.
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
}
