import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { InstructorFeed } from "@/components/jobs/instructor-feed";
import { StudioFeed } from "@/components/jobs/studio-feed";
import { LoadingScreen } from "@/components/loading-screen";

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
    return <InstructorFeed />;
  }

  if (currentUser.role === "studio") {
    return <StudioFeed />;
  }

  return <Redirect href="/" />;
}
