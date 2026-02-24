import { LoadingScreen } from "@/components/loading-screen";
import { lazy, Suspense } from "react";

const LazyCalendarTabScreen = lazy(
  () => import("@/components/calendar/calendar-tab-screen"),
);

export default function CalendarTabRoute() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyCalendarTabScreen />
    </Suspense>
  );
}
