import { useEffect } from "react";
import { Alert, AppState, Platform } from "react-native";

import i18n, { bootstrapLocalization } from "@/i18n";
import { waitForInteractions } from "@/modules/app-shell/wait-for-interactions";

export function useLocalizationBootstrapPrompt() {
  useEffect(() => {
    let cancelled = false;
    let alertShownForDirectionChange = false;

    const run = async (showRestartPrompt: boolean) => {
      try {
        const { directionChanged } = await bootstrapLocalization();
        if (cancelled || !directionChanged || Platform.OS === "web") {
          return;
        }
        if (!showRestartPrompt || alertShownForDirectionChange) {
          return;
        }
        await waitForInteractions();
        if (cancelled) return;
        // Avoid forced runtime reload at startup; ask for manual restart instead.
        try {
          alertShownForDirectionChange = true;
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

    void run(true);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" || Platform.OS === "web") {
        return;
      }
      void run(false);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
