import { Redirect } from "expo-router";
import { LoadingScreen } from "@/components/loading-screen";

import { useUser } from "@/contexts/user-context";

export default function HomeTabRoute() {
  const { currentUser, effectiveRole, isAuthLoading, isAuthenticated } = useUser();

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === undefined || currentUser === null) {
    return <LoadingScreen />;
  }

  const resolvedRole = currentUser.role ?? effectiveRole;

  if (resolvedRole === "instructor") {
    return <Redirect href="/(tabs)/instructor" />;
  }

  if (resolvedRole === "studio") {
    return <Redirect href="/(tabs)/studio" />;
  }

  return <Redirect href="/onboarding" />;
}
