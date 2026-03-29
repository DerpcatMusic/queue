import type { TFunction } from "i18next";
import { useCallback, memo } from "react";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";

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

  const handleApply = useCallback(
    (job: InstructorMarketplaceJob) => onApply(job),
    [onApply],
  );

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
    <View
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.md,
        paddingHorizontal: BrandSpacing.sm,
      }}
    >
      {jobs.map((job, index) => (
        <Animated.View
          key={`animated-${job.jobId}`}
          entering={FadeInUp.delay(Math.min(index, 6) * 36)
            .duration(280)
            .springify()
            .damping(18)}
        >
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
        </Animated.View>
      ))}
    </View>
  );
});
