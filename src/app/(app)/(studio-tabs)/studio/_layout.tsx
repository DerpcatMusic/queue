import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { useUser } from "@/contexts/user-context";
import { RoleTabsLayout } from "@/modules/navigation/role-tabs-layout";
import { ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

export default function StudioTabsLayout() {
  const { currentUser } = useUser();
  const now = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  const tabCountsArgs = useMemo(() => ({ now }), [now]);
  const emptyArgs = useMemo(() => ({}), []);

  const studioTabCounts = useQuery(
    api.jobs.getStudioTabCounts,
    currentUser?.role === "studio" ? tabCountsArgs : "skip",
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
