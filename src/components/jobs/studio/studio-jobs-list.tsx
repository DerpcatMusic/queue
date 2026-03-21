import { FlashList } from "@shopify/flash-list";
import { memo, useCallback } from "react";
import { View } from "react-native";
import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import type { StudioJobsListProps } from "./studio-jobs-list.types";
import { StudioJobCard } from "./studio-jobs-list-parts";

const ESTIMATED_STUDIO_JOB_CARD_HEIGHT = 420;

export const StudioJobsList = memo(function StudioJobsList({
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

  const renderItem = useCallback(
    ({ item, index }: { item: StudioJobsListProps["jobs"][number]; index: number }) => (
      <StudioJobCard
        job={item}
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
    ),
    [
      isWideWeb,
      locale,
      onReview,
      onStartPayment,
      payingJobId,
      palette,
      reviewingApplicationId,
      t,
      zoneLanguage,
    ],
  );

  if (jobs.length === 0) return null;

  return (
    <View
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.sm,
        paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
      }}
    >
      <FlashList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.jobId)}
        drawDistance={ESTIMATED_STUDIO_JOB_CARD_HEIGHT * 2}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: isWideWeb ? 10 : BrandSpacing.sm }} />}
      />
    </View>
  );
});
