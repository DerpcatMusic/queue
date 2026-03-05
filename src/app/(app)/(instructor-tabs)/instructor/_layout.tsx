import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { RoleTabsLayout } from "@/modules/navigation/role-tabs-layout";
import { ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

export default function InstructorTabsLayout() {
  const now = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  const tabCountsArgs = useMemo(() => ({ now }), [now]);
  const emptyArgs = useMemo(() => ({}), []);

  const instructorTabCounts = useQuery(api.jobs.getInstructorTabCounts, tabCountsArgs);
  const unreadNotificationCount = useQuery(api.inbox.getMyUnreadNotificationCount, emptyArgs);

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

  return <RoleTabsLayout appRole="instructor" badgeCountByRoute={badgeCountByRoute} />;
}
