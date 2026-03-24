import { ProfileAddAccountScreen } from "@/components/profile/profile-add-account-screen";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const INSTRUCTOR_PROFILE_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile);

export default function InstructorAddAccountScreen() {
  return (
    <ProfileAddAccountScreen
      profileRoute={INSTRUCTOR_PROFILE_ROUTE}
      routeMatchPath="/profile/add-account"
    />
  );
}
