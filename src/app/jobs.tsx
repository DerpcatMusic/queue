import { RoleAliasRedirect } from "@/components/auth/role-alias-redirect";

export default function JobsAliasRoute() {
  return <RoleAliasRedirect target={{ instructor: "/instructor/jobs", studio: "/studio/jobs" }} />;
}
