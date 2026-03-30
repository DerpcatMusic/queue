import { NotificationSettingsScreen } from "@/components/profile/notification-settings-screen";

export default function StudioNotificationsScreen() {
  return (
    <NotificationSettingsScreen
      role="studio"
      routeMatchPath="/profile/notifications"
    />
  );
}
