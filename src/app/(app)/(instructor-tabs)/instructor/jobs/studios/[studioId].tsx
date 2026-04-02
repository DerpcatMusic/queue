import { useLocalSearchParams } from "expo-router";

import { InstructorJobDetailScreen } from "@/features/jobs/instructor-job-detail-screen";

export default function InstructorStudioProfileRoute() {
  const params = useLocalSearchParams<{ studioId?: string; jobId?: string }>();
  const studioId = Array.isArray(params.studioId) ? params.studioId[0] : params.studioId;
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  return (
    <InstructorJobDetailScreen
      studioId={studioId}
      jobId={jobId}
      sheetTabId="jobs"
      ownerPrefix="studio-job-detail"
    />
  );
}
