import { RoleAliasRedirect } from "@/components/auth/role-alias-redirect";

export default function MapAliasRoute() {
  return <RoleAliasRedirect target={{ instructor: "/instructor/map", studio: "/studio" }} />;
}
