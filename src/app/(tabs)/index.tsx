import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

export default function HomeTabRoute() {
  const { currentUser } = useUser();

  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  if (currentUser?.role === "instructor") {
    return <Redirect href="/(tabs)/instructor" />;
  }

  if (currentUser?.role === "studio") {
    return <Redirect href="/(tabs)/studio" />;
  }

  return <Redirect href="/onboarding" />;
}
