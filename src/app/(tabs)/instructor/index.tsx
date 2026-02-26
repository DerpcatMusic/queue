import { RoleRouteGate } from "@/components/auth/role-route-gate";
import HomeScreen from "@/components/home/home-screen";

export default function InstructorHomeRoute() {
  return (
    <RoleRouteGate requiredRole="instructor" redirectHref="/(tabs)/studio">
      <HomeScreen />
    </RoleRouteGate>
  );
}
