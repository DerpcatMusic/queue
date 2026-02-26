import { useTranslation } from "react-i18next";

import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { StudioFeed } from "@/components/jobs/studio-feed";

export default function StudioJobsRoute() {
  const { t } = useTranslation();

  return (
    <RoleRouteGate
      requiredRole="studio"
      redirectHref="/(tabs)/instructor/jobs"
      loadingLabel={t("jobsTab.loading")}
    >
      <StudioFeed />
    </RoleRouteGate>
  );
}
