import { useQuery } from "convex/react";
import { useMemo, useRef } from "react";

import { api } from "@/convex/_generated/api";
import { useUser } from "@/contexts/user-context";
import { RoleTabsLayout } from "@/modules/navigation/role-tabs-layout";
import { ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const TAB_COUNTS_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default function StudioTabsLayout() {
  const { currentUser } = useUser();
  const now = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  const tabCountsArgs = useMemo(() => ({ now }), [now]);

  // Deduplicate: only update tabCountsArgs every 5 minutes to prevent Convex
  // from refetching every minute with a new object reference
  const tabCountsArgsRef = useRef(tabCountsArgs);
  const lastTabCountsUpdateRef = useRef<number>(Date.now());
  if (
    currentUser?.role === "studio" &&
    Date.now() - lastTabCountsUpdateRef.current > TAB_COUNTS_TTL_MS
  ) {
    tabCountsArgsRef.current = tabCountsArgs;
    lastTabCountsUpdateRef.current = Date.now();
  }

  const emptyArgs = useMemo(() => ({}), []);

  const studioTabCounts = useQuery(
    api.jobs.getStudioTabCounts,
    currentUser?.role === "studio" ? tabCountsArgsRef.current : "skip",
  );
  const unreadNotificationCount = useQuery(
    api.inbox.getMyUnreadNotificationCount,
    currentUser?.role === "studio" ? emptyArgs : "skip",
  );

  const jobsBadgeCount = studioTabCounts?.jobsBadgeCount ?? 0;
  const calendarBadgeCount = studioTabCounts?.calendarBadgeCount ?? 0;
  const profileBadgeCount = unreadNotificationCount?.count ?? 0;
  const badgeCountByRoute = useMemo(
    () => ({
      [ROLE_TAB_ROUTE_NAMES.jobs]: jobsBadgeCount,
      [ROLE_TAB_ROUTE_NAMES.calendar]: calendarBadgeCount,
      [ROLE_TAB_ROUTE_NAMES.profile]: profileBadgeCount,
    }),
    [calendarBadgeCount, jobsBadgeCount, profileBadgeCount],
  );

  return <RoleTabsLayout appRole="studio" badgeCountByRoute={badgeCountByRoute} />;
}
