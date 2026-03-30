import { NotificationSettingsScreen } from "@/components/profile/notification-settings-screen";

export default function InstructorNotificationsScreen() {
  return (
    <NotificationSettingsScreen
      role="instructor"
      routeMatchPath="/profile/notifications"
    />
  );
}
