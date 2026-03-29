import { InstructorJobsTab } from "@/components/jobs";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function InstructorJobsRoute() {
  const descriptorBody = <InstructorJobsTab />;
  useTabSceneDescriptor({ tabId: "jobs", body: descriptorBody, insetTone: "sheet" });

  return descriptorBody;
}
