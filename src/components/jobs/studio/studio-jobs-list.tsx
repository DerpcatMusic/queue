import { FlashList } from "@shopify/flash-list";
import { memo, useCallback } from "react";
import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { Box } from "@/primitives";
import type { StudioJobsListProps } from "./studio-jobs-list.types";
import { StudioJobCard } from "./studio-jobs-list-parts";

const ESTIMATED_STUDIO_JOB_CARD_HEIGHT = 360;

export const StudioJobsList = memo(function StudioJobsList({
  jobs,
  locale,
  zoneLanguage,
  reviewingApplicationId,
  payingJobId,
  onInstructorPress,
  onReview,
  onStartPayment,
  onStartNativeWalletPayment,
  onStartEmbeddedCheckout,
  onJobPress,
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
        reviewingApplicationId={reviewingApplicationId}
        payingJobId={payingJobId}
        {...(onInstructorPress ? { onInstructorPress } : {})}
        onReview={onReview}
        onStartPayment={onStartPayment}
        onStartNativeWalletPayment={onStartNativeWalletPayment}
        onStartEmbeddedCheckout={onStartEmbeddedCheckout}
        onJobPress={onJobPress}
        t={t}
      />
    ),
    [
      isWideWeb,
      locale,
      onInstructorPress,
      onReview,
      onStartPayment,
      onStartNativeWalletPayment,
      onStartEmbeddedCheckout,
      onJobPress,
      payingJobId,
      reviewingApplicationId,
      t,
      zoneLanguage,
    ],
  );

  if (jobs.length === 0) return null;

  return (
    <Box
      style={{
        gap: isWideWeb ? BrandSpacing.md : BrandSpacing.sm,
        paddingHorizontal: isWideWeb ? BrandSpacing.lg : BrandSpacing.md,
      }}
    >
      <FlashList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.jobId)}
        drawDistance={ESTIMATED_STUDIO_JOB_CARD_HEIGHT * 2}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <Box style={{ height: isWideWeb ? BrandSpacing.md : BrandSpacing.sm }} />
        )}
      />
    </Box>
  );
});
