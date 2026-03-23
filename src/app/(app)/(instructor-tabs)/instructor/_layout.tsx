import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { Platform } from "react-native";

import { warmMapStyleSpec } from "@/components/maps/queue-map.native.helpers";
import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import { api } from "@/convex/_generated/api";
import { RoleTabsLayout } from "@/modules/navigation/role-tabs-layout";
import { ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

export default function InstructorTabsLayout() {
  const now = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  const tabCountsArgs = useMemo(() => ({ now }), [now]);
  const emptyArgs = useMemo(() => ({}), []);

  const instructorTabCounts = useQuery(api.jobs.getInstructorTabCounts, tabCountsArgs);
  const unreadNotificationCount = useQuery(api.inbox.getMyUnreadNotificationCount, emptyArgs);
  useQuery(api.instructorZones.getMyInstructorZones, emptyArgs);

  const jobsBadgeCount = instructorTabCounts?.jobsBadgeCount ?? 0;
  const calendarBadgeCount = instructorTabCounts?.calendarBadgeCount ?? 0;
  const profileBadgeCount = unreadNotificationCount?.count ?? 0;
  const badgeCountByRoute = useMemo(
    () => ({
      [ROLE_TAB_ROUTE_NAMES.jobs]: jobsBadgeCount,
      [ROLE_TAB_ROUTE_NAMES.calendar]: calendarBadgeCount,
      [ROLE_TAB_ROUTE_NAMES.profile]: profileBadgeCount,
    }),
    [calendarBadgeCount, jobsBadgeCount, profileBadgeCount],
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const schedulePrewarm = () => {
      if (cancelled) {
        return;
      }

      warmMapStyleSpec(APPLE_MAP_THEME.mapStyleLightUrl);
      warmMapStyleSpec(APPLE_MAP_THEME.mapStyleDarkUrl);

      void import("@/components/maps/queue-map.native");
      void import("@/constants/zones-map");
      void import("@/components/map-tab/map-tab/use-map-tab-controller");
      void import("@/components/map-tab/map-tab/map-sheet-header");
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      idleId = globalThis.requestIdleCallback(schedulePrewarm, { timeout: 600 });
    } else {
      timeoutId = setTimeout(schedulePrewarm, 120);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof globalThis.cancelIdleCallback === "function") {
        globalThis.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return <RoleTabsLayout appRole="instructor" badgeCountByRoute={badgeCountByRoute} />;
}
