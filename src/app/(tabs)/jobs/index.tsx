import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { lazy, Suspense } from "react";

import { LoadingScreen } from "@/components/loading-screen";

const LazyInstructorFeed = lazy(() =>
  import("@/components/jobs/instructor-feed").then((module) => ({
    default: module.InstructorFeed,
  })),
);
const LazyStudioFeed = lazy(() =>
  import("@/components/jobs/studio-feed").then((module) => ({
    default: module.StudioFeed,
  })),
);

export default function JobsTabScreen() {
  const { t } = useTranslation();
  const currentUser = useQuery(api.users.getCurrentUser);

  if (currentUser === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (currentUser.role === "instructor") {
    return (
      <Suspense fallback={<LoadingScreen label={t("jobsTab.loading")} />}>
        <LazyInstructorFeed />
      </Suspense>
    );
  }

  if (currentUser.role === "studio") {
    return (
      <Suspense fallback={<LoadingScreen label={t("jobsTab.loading")} />}>
        <LazyStudioFeed />
      </Suspense>
    );
  }

  return <Redirect href="/" />;
}
