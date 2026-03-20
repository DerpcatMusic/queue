import { View } from "react-native";
import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import type { StudioJobsListProps } from "./studio-jobs-list.types";
import { StudioJobCard } from "./studio-jobs-list-parts";

export function StudioJobsList({
  jobs,
  locale,
  zoneLanguage,
  palette,
  reviewingApplicationId,
  payingJobId,
  onReview,
  onStartPayment,
  t,
}: StudioJobsListProps) {
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();

  if (jobs.length === 0) return null;

  return (
    <View
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.sm,
        paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
      }}
    >
      {jobs.map((job, index) => {
        return (
          <StudioJobCard
            key={job.jobId}
            job={job}
            index={index}
            isWideWeb={isWideWeb}
            locale={locale}
            zoneLanguage={zoneLanguage}
            palette={palette}
            reviewingApplicationId={reviewingApplicationId}
            payingJobId={payingJobId}
            onReview={onReview}
            onStartPayment={onStartPayment}
            t={t}
          />
        );
      })}
    </View>
  );
}
