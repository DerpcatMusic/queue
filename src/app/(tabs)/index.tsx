import { Redirect } from "expo-router";

import { useUser } from "@/contexts/user-context";

export default function HomeTabRoute() {
  const { currentUser, effectiveRole } = useUser();
  const resolvedRole = currentUser?.role ?? effectiveRole;

  if (resolvedRole === "instructor") {
    return <Redirect href="/(tabs)/instructor" />;
  }

  if (resolvedRole === "studio") {
    return <Redirect href="/(tabs)/studio" />;
  }

  return <Redirect href="/onboarding" />;
}
