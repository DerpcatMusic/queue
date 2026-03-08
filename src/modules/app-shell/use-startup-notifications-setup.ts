import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

import { waitForInteractions } from "@/modules/app-shell/wait-for-interactions";

export function useStartupNotificationsSetup() {
  useEffect(() => {
    if (Platform.OS === "web" || Constants.appOwnership === "expo") {
      return;
    }

    let cancelled = false;
    const setupNotificationsAfterInteractions = async () => {
      await waitForInteractions();
      if (cancelled) return;
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

    void setupNotificationsAfterInteractions();
    return () => {
      cancelled = true;
    };
  }, []);
}
