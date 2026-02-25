import { LoadingScreen } from "@/components/loading-screen";
import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { useIsFocused } from "@react-navigation/native";
import { lazy, Suspense } from "react";
import { useEffect, useState } from "react";

const LazyCalendarTabScreen = lazy(
  () => import("@/components/calendar/calendar-tab-screen"),
);

export default function CalendarTabRoute() {
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  return (
    <RoleRouteGate requiredRole="studio" redirectHref="/(tabs)/instructor/calendar/index">
      {!hasActivated ? (
        <LoadingScreen />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <LazyCalendarTabScreen />
        </Suspense>
      )}
    </RoleRouteGate>
  );
}
