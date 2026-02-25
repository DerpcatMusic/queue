import { Redirect } from "expo-router";
import { lazy, Suspense } from "react";

import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

const LazyHomeScreen = lazy(() => import("@/components/home/home-screen"));

export default function InstructorHomeRoute() {
  const { currentUser } = useUser();

  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/(tabs)/studio" />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyHomeScreen />
    </Suspense>
  );
}
