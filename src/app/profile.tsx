import { RoleAliasRedirect } from "@/components/auth/role-alias-redirect";

export default function ProfileAliasRoute() {
  return (
    <RoleAliasRedirect target={{ instructor: "/instructor/profile", studio: "/studio/profile" }} />
  );
}
