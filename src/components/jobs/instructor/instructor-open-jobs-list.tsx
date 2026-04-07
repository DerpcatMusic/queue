import type { TFunction } from "i18next";
import { memo, useCallback } from "react";
import { InstructorJobCard } from "@/components/jobs/instructor/instructor-job-card";
import { BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { Box } from "@/primitives";

type InstructorOpenJobsListProps = {
  jobs: InstructorMarketplaceJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  applyingJobId: Id<"jobs"> | null;
  withdrawingApplicationId: Id<"jobApplications"> | null;
  now: number;
  onApply: (job: InstructorMarketplaceJob) => void;
  onWithdrawApplication: (applicationId: Id<"jobApplications">) => void;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  t: TFunction;
};

export const InstructorOpenJobsList = memo(function InstructorOpenJobsList({
  jobs,
  locale,
  zoneLanguage,
  applyingJobId,
  withdrawingApplicationId,
  now,
  onApply,
  onWithdrawApplication,
  onOpenStudio,
  t,
}: InstructorOpenJobsListProps) {
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();

  const handleApply = useCallback((job: InstructorMarketplaceJob) => onApply(job), [onApply]);

  const handleWithdraw = useCallback(
    (applicationId: Id<"jobApplications">) => onWithdrawApplication(applicationId),
    [onWithdrawApplication],
  );

  const handleOpenStudio = useCallback(
    (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => onOpenStudio(studioId, jobId),
    [onOpenStudio],
  );

  if (jobs.length === 0) return null;

  return (
    <Box
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.md,
        paddingHorizontal: BrandSpacing.sm,
      }}
    >
      {jobs.map((job) => (
        <Box key={`job-${job.jobId}`}>
          <InstructorJobCard
            job={job}
            locale={locale}
            zoneLanguage={zoneLanguage}
            applyingJobId={applyingJobId}
            withdrawingApplicationId={withdrawingApplicationId}
            now={now}
            onApply={handleApply}
            onWithdrawApplication={handleWithdraw}
            onOpenStudio={handleOpenStudio}
            t={t}
          />
        </Box>
      ))}
    </Box>
  );
});
