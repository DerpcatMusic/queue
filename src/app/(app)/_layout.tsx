import { Redirect, Slot, usePathname } from "expo-router";

import { resolveSessionState } from "@/auth/session-guard";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

function isRolePath(pathname: string, role: "instructor" | "studio") {
  return pathname === `/${role}` || pathname.startsWith(`/${role}/`);
}

export default function AppGateLayout() {
  const pathname = usePathname();
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

  if (isRolePath(pathname, session.role)) {
    return <Slot />;
  }

  if (session.role === "instructor") {
    return <Redirect href="/instructor" />;
  }

  return <Redirect href="/studio" />;
}
