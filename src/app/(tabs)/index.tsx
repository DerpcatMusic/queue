import { LoadingScreen } from "@/components/loading-screen";
import { lazy, Suspense } from "react";

const LazyHomeScreen = lazy(() => import("@/components/home/home-screen"));

export default function HomeTabRoute() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyHomeScreen />
    </Suspense>
  );
}
