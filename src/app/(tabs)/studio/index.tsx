import { Redirect } from "expo-router";
import { lazy, Suspense } from "react";

import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

const LazyHomeScreen = lazy(() => import("@/components/home/home-screen"));

export default function StudioHomeRoute() {
  const { currentUser } = useUser();

  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "studio") {
    return <Redirect href="/(tabs)/instructor" />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyHomeScreen />
    </Suspense>
  );
}
