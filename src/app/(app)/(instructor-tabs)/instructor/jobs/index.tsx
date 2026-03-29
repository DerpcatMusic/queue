import { useMemo } from "react";
import { InstructorJobsTab } from "@/components/jobs";
import { JobsSectionHeader } from "@/components/jobs/jobs-tab/jobs-section-header";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function InstructorJobsRoute() {
  const sheetContent = useMemo(
    () => <JobsSectionHeader title="Available Jobs" />,
    [],
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

  const descriptorBody = <InstructorJobsTab />;

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
