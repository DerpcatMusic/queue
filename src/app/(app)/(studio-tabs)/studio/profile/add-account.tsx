import { ProfileAddAccountScreen } from "@/components/profile/profile-add-account-screen";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const STUDIO_PROFILE_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile);

export default function StudioAddAccountScreen() {
  return (
    <ProfileAddAccountScreen
      profileRoute={STUDIO_PROFILE_ROUTE}
      routeMatchPath="/profile/add-account"
    />
  );
}
