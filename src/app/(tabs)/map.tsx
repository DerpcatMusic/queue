import { LoadingScreen } from "@/components/loading-screen";
import { lazy, Suspense } from "react";

const LazyMapTabScreen = lazy(() => import("@/components/map-tab/map-tab-screen"));

export default function MapTabRoute() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyMapTabScreen />
    </Suspense>
  );
}
