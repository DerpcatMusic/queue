import { Redirect } from "expo-router";

import { resolveSessionState } from "@/auth/session-guard";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

type RoleAliasTarget = {
  instructor:
    | "/instructor"
    | "/instructor/jobs"
    | "/instructor/calendar"
    | "/instructor/map"
    | "/instructor/profile";
  studio: "/studio" | "/studio/jobs" | "/studio/calendar" | "/studio/profile";
};

export function RoleAliasRedirect({ target }: { target: RoleAliasTarget }) {
  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const session = resolveSessionState({
    isAuthLoading,
    isAuthenticated,
    currentUser,
  });

  if (session.status === "loading") {
    return <LoadingScreen label="Loading account..." />;
  }

  if (session.status === "signed_out") {
    return <Redirect href="/sign-in" />;
  }

  if (session.status === "onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={session.role === "instructor" ? target.instructor : target.studio} />;
}
