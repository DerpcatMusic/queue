import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");
type NotificationPermissionsStatus = Awaited<
  ReturnType<NotificationsModule["getPermissionsAsync"]>
>;

export function hasGrantedNotificationPermission(
  Notifications: NotificationsModule,
  permissionStatus: NotificationPermissionsStatus,
): boolean {
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
): Promise<boolean> {
  const existingPermissions = await Notifications.getPermissionsAsync();
  if (hasGrantedNotificationPermission(Notifications, existingPermissions)) {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return hasGrantedNotificationPermission(Notifications, requestedPermissions);
}
