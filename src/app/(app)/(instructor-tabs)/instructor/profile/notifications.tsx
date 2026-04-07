import { NotificationSettingsScreen } from "@/components/profile/notification-settings-screen";

export default function InstructorNotificationsScreen() {
  return (
    <NotificationSettingsScreen actorRole="instructor" routeMatchPath="/profile/notifications" />
  );
}
