import { RoleRouteGate } from "@/components/auth/role-route-gate";
import MapTabScreen from "@/components/map-tab/map-tab-screen";

export default function MapTabRoute() {
  return (
    <RoleRouteGate requiredRole="instructor" redirectHref="/(tabs)/studio">
      <MapTabScreen />
    </RoleRouteGate>
  );
}
