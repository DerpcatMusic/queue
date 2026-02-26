import { useTranslation } from "react-i18next";

import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { InstructorFeed } from "@/components/jobs/instructor-feed";

export default function InstructorJobsRoute() {
  const { t } = useTranslation();

  return (
    <RoleRouteGate
      requiredRole="instructor"
      redirectHref="/(tabs)/studio/jobs"
      loadingLabel={t("jobsTab.loading")}
    >
      <InstructorFeed />
    </RoleRouteGate>
  );
}
