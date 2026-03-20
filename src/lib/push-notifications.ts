import Constants from "expo-constants";
import { Platform } from "react-native";
import { requestNotificationPermissionIfNeeded } from "@/lib/notification-permissions";

export type PushRegistrationErrorCode =
  | "web_unsupported"
  | "expo_go_unsupported"
  | "physical_device_required"
  | "native_module_unavailable"
  | "permission_denied";

export class PushRegistrationError extends Error {
  constructor(
    readonly code: PushRegistrationErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "PushRegistrationError";
  }
}

export function isPushRegistrationError(error: unknown): error is PushRegistrationError {
  return error instanceof PushRegistrationError;
}

export async function registerForPushNotificationsAsync(): Promise<string> {
  if (Platform.OS === "web") {
    throw new PushRegistrationError("web_unsupported");
  }

  if (Constants.appOwnership === "expo") {
    throw new PushRegistrationError("expo_go_unsupported");
  }

  let isPhysicalDevice = true;
  try {
    const Device = await import("expo-device");
    isPhysicalDevice = Device.isDevice;
  } catch {
    throw new PushRegistrationError("native_module_unavailable");
  }

  if (!isPhysicalDevice) {
    throw new PushRegistrationError("physical_device_required");
  }

  let Notifications: typeof import("expo-notifications");
  try {
    Notifications = await import("expo-notifications");
  } catch {
    throw new PushRegistrationError("native_module_unavailable");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const hasPermission = await requestNotificationPermissionIfNeeded(Notifications);
  if (!hasPermission) {
    throw new PushRegistrationError("permission_denied");
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    throw new Error(
      "Push notifications are not configured for this build yet. Missing EAS project ID.",
    );
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}
