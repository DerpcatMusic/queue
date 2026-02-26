import { RoleRouteGate } from "@/components/auth/role-route-gate";
import CalendarTabScreen from "@/components/calendar/calendar-tab-screen";

export default function CalendarTabRoute() {
  return (
    <RoleRouteGate requiredRole="instructor" redirectHref="/(tabs)/studio/calendar">
      <CalendarTabScreen />
    </RoleRouteGate>
  );
}
