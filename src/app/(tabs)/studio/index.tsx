import { RoleRouteGate } from "@/components/auth/role-route-gate";
import HomeScreen from "@/components/home/home-screen";

export default function StudioHomeRoute() {
  return (
    <RoleRouteGate requiredRole="studio" redirectHref="/(tabs)/instructor">
      <HomeScreen />
    </RoleRouteGate>
  );
}
