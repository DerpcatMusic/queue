import { useIsFocused } from "@react-navigation/native";
import { lazy, Suspense } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { RoleRouteGate } from "@/components/auth/role-route-gate";

const LazyStudioFeed = lazy(() =>
  import("@/components/jobs/studio-feed").then((module) => ({
    default: module.StudioFeed,
  })),
);

export default function StudioJobsRoute() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  return (
    <RoleRouteGate
      requiredRole="studio"
      redirectHref="/(tabs)/instructor/jobs"
      loadingLabel={t("jobsTab.loading")}
    >
      {!hasActivated ? (
        <LoadingScreen label={t("jobsTab.loading")} />
      ) : (
        <Suspense fallback={<LoadingScreen label={t("jobsTab.loading")} />}>
          <LazyStudioFeed />
        </Suspense>
      )}
    </RoleRouteGate>
  );
}
