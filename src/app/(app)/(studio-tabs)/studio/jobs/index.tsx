import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StudioJobsTab } from "@/components/jobs";
import { JobsSectionHeader } from "@/components/jobs/jobs-tab/jobs-section-header";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function StudioJobsRoute() {
  const { t } = useTranslation();

  const sheetContent = useMemo(
    () => <JobsSectionHeader title={t("jobsTab.studioFeed.boardTitle")} />,
    [t],
  );

  const sheetConfig = useMemo(
    () => ({
      render: () => ({
        children: sheetContent,
      }),
      steps: [0] as const,
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
    }),
    [sheetContent],
  );

  const descriptorBody = <StudioJobsTab />;

  const descriptor = useMemo(
    () => ({
      tabId: "jobs" as const,
      body: descriptorBody,
      sheetConfig,
      insetTone: "sheet" as const,
    }),
    [descriptorBody, sheetConfig],
  );

  useTabSceneDescriptor(descriptor);

  return descriptorBody;
}
