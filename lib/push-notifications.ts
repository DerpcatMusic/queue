import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { requestNotificationPermissionIfNeeded } from "@/lib/notification-permissions";

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  if (Constants.appOwnership === "expo") {
    return null;
  }

  if (!Device.isDevice) return null;

  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const hasPermission =
    await requestNotificationPermissionIfNeeded(Notifications);
  if (!hasPermission) return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;
  if (!projectId) throw new Error("EAS projectId not found in app config");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}
