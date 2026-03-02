import { RoleAliasRedirect } from "@/components/auth/role-alias-redirect";

export default function RootIndexRoute() {
  return <RoleAliasRedirect target={{ instructor: "/instructor", studio: "/studio" }} />;
}
