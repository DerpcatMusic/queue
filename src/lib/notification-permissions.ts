import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");
type NotificationPermissionsStatus = Awaited<
  ReturnType<NotificationsModule["getPermissionsAsync"]>
>;

function hasGrantedNotificationPermission(
  Notifications: NotificationsModule,
  permissionStatus: NotificationPermissionsStatus,
): boolean {
  if (
    Platform.OS === "android" &&
    typeof Platform.Version === "number" &&
    Platform.Version < 33
  ) {
    return true;
  }

  if (permissionStatus.granted) {
    return true;
  }

  if (Platform.OS !== "ios") {
    return false;
  }

  const iosStatus = permissionStatus.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function requestNotificationPermissionIfNeeded(
  Notifications: NotificationsModule,
  options?: {
    requestIfNeeded?: boolean;
  },
): Promise<boolean> {
  const existingPermissions = await Notifications.getPermissionsAsync();
  if (hasGrantedNotificationPermission(Notifications, existingPermissions)) {
    return true;
  }

  if (options?.requestIfNeeded === false) {
    return false;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    android: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowVibration: true,
    },
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return hasGrantedNotificationPermission(Notifications, requestedPermissions);
}
