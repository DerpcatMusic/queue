import { useIsFocused } from "@react-navigation/native";
import { lazy, Suspense } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { RoleRouteGate } from "@/components/auth/role-route-gate";

const LazyInstructorFeed = lazy(() =>
  import("@/components/jobs/instructor-feed").then((module) => ({
    default: module.InstructorFeed,
  })),
);

export default function InstructorJobsRoute() {
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
      requiredRole="instructor"
      redirectHref="/(tabs)/studio/jobs"
      loadingLabel={t("jobsTab.loading")}
    >
      {!hasActivated ? (
        <LoadingScreen label={t("jobsTab.loading")} />
      ) : (
        <Suspense fallback={<LoadingScreen label={t("jobsTab.loading")} />}>
          <LazyInstructorFeed />
        </Suspense>
      )}
    </RoleRouteGate>
  );
}
