import { RoleAliasRedirect } from "@/components/auth/role-alias-redirect";

export default function CalendarAliasRoute() {
  return (
    <RoleAliasRedirect
      target={{ instructor: "/instructor/calendar", studio: "/studio/calendar" }}
    />
  );
}
