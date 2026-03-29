import { StudioJobsTab } from "@/components/jobs";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function StudioJobsRoute() {
  const descriptorBody = <StudioJobsTab />;
  useTabSceneDescriptor({ tabId: "jobs", body: descriptorBody, insetTone: "sheet" });

  return descriptorBody;
}
