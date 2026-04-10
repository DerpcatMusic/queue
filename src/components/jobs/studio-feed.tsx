import type BottomSheet from "@gorhom/bottom-sheet";
import { useAction } from "convex/react";
import { useIsFocused } from "@react-navigation/native";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { JobsSectionHeader } from "@/components/jobs/jobs-tab/jobs-section-header";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
import { StudioJobDetailSheet } from "@/components/jobs/studio/studio-job-detail-sheet";
import { StudioJobsArchiveSheet } from "@/components/jobs/studio/studio-jobs-archive-sheet";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import { StudioJobsTopSheetHeader } from "@/components/jobs/studio/studio-jobs-top-sheet";
import { useStudioFeedController } from "@/components/jobs/studio/use-studio-feed-controller";
import { StripeEmbeddedCheckoutSheet } from "@/components/sheets/profile/studio/stripe-embedded-checkout-sheet";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import {
  createContentDrivenTopSheetConfig,
  getMainTabSheetBackgroundColor,
} from "@/components/layout/top-sheet-registry";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";
import { buildInstructorProfileRoute } from "@/navigation/public-profile-routes";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import { Box, HStack, Text, VStack } from "@/primitives";
import { Motion, Spring } from "@/theme/theme";

// ============================================================
// Skeleton Components
// ============================================================

function SkeletonJobList() {
  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <View style={{ gap: BrandSpacing.lg, padding: BrandSpacing.lg }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonJobCard key={i} />
        ))}
      </View>
    </Animated.View>
  );
}

function SkeletonJobCard() {
  const { color } = useTheme();

  return (
    <View
      style={{
        padding: BrandSpacing.lg,
        backgroundColor: color.surfaceElevated,
        borderRadius: BrandRadius.card,
        gap: BrandSpacing.md,
      }}
    >
      <HStack gap="md" align="start">
        <SkeletonLine width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
          <SkeletonLine width="50%" height={16} />
          <SkeletonLine width="30%" height={12} />
        </View>
        <SkeletonLine width={60} height={24} radius={12} />
      </HStack>
      <SkeletonLine width="100%" height={12} />
      <HStack gap="md">
        <SkeletonLine width={80} height={20} radius={10} />
        <SkeletonLine width={80} height={20} radius={10} />
      </HStack>
    </View>
  );
}

export function StudioFeed() {
  const router = useRouter();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const [
    ,
    /* isCreateSheetVisible, unused but needed for sheet tracking */ setIsCreateSheetVisible,
  ] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [embeddedCheckoutDetails, setEmbeddedCheckoutDetails] = useState<null | {
    clientSecret: string;
    customerSessionClientSecret: string;
    amountAgorot: number;
    currency: string;
    providerCountry: string;
  }>(null);
  const [embeddedCheckoutVisible, setEmbeddedCheckoutVisible] = useState(false);
  const detailSheetRef = useRef<BottomSheet>(null);
  const archiveSheetRef = useRef<BottomSheet>(null);
  const createStudioCustomerSheetSession = useAction(
    api.paymentsV2Actions.createMyStudioStripeCustomerSheetSessionV2,
  );

  // Expand sheet when job is selected (handle render timing)
  useEffect(() => {
    if (selectedJobId) {
      // Use setTimeout to ensure sheet has mounted before expand
      const timer = setTimeout(() => {
        detailSheetRef.current?.expand();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [selectedJobId]);

  const signInRoute = "/sign-in" as const;
  const onboardingRoute = "/onboarding" as const;
  const instructorJobsRoute = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
  const {
    createJobSheetRef,
    currentUser,
    errorMessage,
    filteredStudioJobs,
    filteredStudioJobsWithPayments,
    isEnablingStudioPush,
    isReviewingApplicationId,
    isStartingCheckoutForJobId,
    isSubmittingStudio,
    jobsTimeFilter,
    postStudioJob,
    reviewStudioApplication,
    setErrorMessage,
    setJobsTimeFilter,
    setStatusMessage,
    buildStripeCheckoutDetails,
    startStudioCheckout,
    startStudioNativeWalletCheckout,
    statusMessage,
    studioBranches,
    studioJobs,
    studioNotificationSettings,
    toggleStudioPush,
  } = useStudioFeedController({ t });
  const defaultBranchId =
    studioBranches?.length === 1 ? (studioBranches[0]?.branchId ?? null) : null;
  const areStudioBranchesReady = studioBranches !== undefined;
  const isLoading = currentUser === undefined || studioJobs === undefined;
  const now = Date.now();

  // Hook for skeleton → content transition (must be called before any early returns)
  const contentReveal = useContentReveal(isLoading);

  // Separate past jobs from active jobs
  const pastJobs = filteredStudioJobsWithPayments.filter((job) => job.startTime < now);
  const activeJobs = filteredStudioJobsWithPayments.filter((job) => job.startTime >= now);

  // Active jobs split into review queue and board
  const reviewQueueJobs = activeJobs.filter((job) => job.pendingApplicationsCount > 0);
  const boardJobs = activeJobs.filter((job) => job.pendingApplicationsCount === 0);

  const shouldSplitBoard = reviewQueueJobs.length > 0 && boardJobs.length > 0;
  const primaryJobs = activeJobs;
  const primarySectionShowsReviewQueue = reviewQueueJobs.length > 0 && boardJobs.length === 0;
  const primarySectionTitle = primarySectionShowsReviewQueue
    ? t("jobsTab.studioFeed.needsReviewTitle")
    : t("jobsTab.studioFeed.boardTitle");
  const primarySectionSubtitle = primarySectionShowsReviewQueue
    ? t("jobsTab.studioFeed.mobileDecisionWaiting", {
        count: primaryJobs.length,
      })
    : t("jobsTab.studioFeed.boardSubtitle", {
        count: primaryJobs.length,
      });

  const handleToggleJobsFilters = useCallback(() => {
    setIsFilterExpanded((current) => !current);
  }, []);

  const handleChangeJobsFilter = useCallback(
    (filter: typeof jobsTimeFilter) => {
      setJobsTimeFilter(filter);
    },
    [setJobsTimeFilter],
  );

  const handleReviewApplication = useCallback(
    (
      applicationId: Parameters<typeof reviewStudioApplication>[0],
      status: Parameters<typeof reviewStudioApplication>[1],
    ) => {
      void reviewStudioApplication(applicationId, status);
    },
    [reviewStudioApplication],
  );
  const handleStartPayment = useCallback(
    (jobId: Parameters<typeof startStudioCheckout>[0]) => {
      void startStudioCheckout(jobId);
    },
    [startStudioCheckout],
  );
  const handleStartNativeWalletPayment = useCallback(
    (jobId: Parameters<typeof startStudioNativeWalletCheckout>[0]) => {
      void startStudioNativeWalletCheckout(jobId);
    },
    [startStudioNativeWalletCheckout],
  );
  const handleStartEmbeddedCheckout = useCallback(
    async (jobId: Parameters<typeof buildStripeCheckoutDetails>[0]) => {
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        const paymentDetails = await buildStripeCheckoutDetails(jobId);
        if (!paymentDetails) return;

        const customerSheetSession = await createStudioCustomerSheetSession();
        setEmbeddedCheckoutDetails({
          clientSecret: paymentDetails.checkout.clientSecret,
          customerSessionClientSecret: customerSheetSession.customerSessionClientSecret,
          amountAgorot: paymentDetails.checkout.amountAgorot,
          currency: paymentDetails.checkout.currency,
          providerCountry: paymentDetails.checkout.providerCountry,
        });
        setEmbeddedCheckoutVisible(true);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("jobsTab.errors.failedToStartCheckout");
        setErrorMessage(message);
      }
    },
    [buildStripeCheckoutDetails, createStudioCustomerSheetSession, setErrorMessage, setStatusMessage, t],
  );
  const handleJobPress = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
  }, []);
  const handleInstructorPress = useCallback(
    (instructorId: Id<"instructorProfiles">) => {
      router.push(
        buildInstructorProfileRoute({ owner: "jobs", instructorId: String(instructorId) }),
      );
    },
    [router],
  );

  const jobsSheetConfig = useMemo(() => {
    const sheetBackgroundColor = getMainTabSheetBackgroundColor(theme);
    return createContentDrivenTopSheetConfig({
      collapsedContent: (
        <StudioJobsTopSheetHeader
          currentFilter={jobsTimeFilter}
          notificationsEnabled={Boolean(studioNotificationSettings?.notificationsEnabled)}
          isTogglingNotifications={isEnablingStudioPush}
          onToggleNotifications={toggleStudioPush}
          isFilterExpanded={isFilterExpanded}
          onToggleFilter={handleToggleJobsFilters}
          onChangeFilter={handleChangeJobsFilter}
          t={t}
        />
      ),
      padding: {
        vertical: BrandSpacing.sm,
        horizontal: BrandSpacing.xl,
      },
      draggable: false,
      expandable: false,
      backgroundColor: sheetBackgroundColor,
      topInsetColor: sheetBackgroundColor,
    });
  }, [
    handleChangeJobsFilter,
    handleToggleJobsFilters,
    isEnablingStudioPush,
    isFilterExpanded,
    jobsTimeFilter,
    studioNotificationSettings?.notificationsEnabled,
    t,
    theme,
    toggleStudioPush,
  ]);
  useTabSceneDescriptor({
    tabId: "jobs",
    insetTone: "sheet",
    sheetConfig: jobsSheetConfig,
  });

  if (currentUser === null) {
    return <Redirect href={signInRoute} />;
  }

  if (!currentUser?.onboardingComplete || currentUser?.role === "pending") {
    return <Redirect href={onboardingRoute} />;
  }

  if (currentUser?.role === "instructor") {
    return <Redirect href={instructorJobsRoute} />;
  }

  if (currentUser?.role !== "studio") {
    return <Redirect href={onboardingRoute} />;
  }

  return (
    <TabSceneTransition>
      <Box flex={1} style={{ backgroundColor: theme.color.appBg }}>
        {isLoading ? (
          <SkeletonJobList />
        ) : (
          <Animated.View style={[{ flex: 1 }, contentReveal.animatedStyle]}>
            <TabScreenScrollView
              routeKey="studio/jobs/index"
              style={[styles.screen, { backgroundColor: theme.color.appBg }]}
              contentContainerStyle={styles.content}
              sheetInsets={{
                topSpacing: BrandSpacing.lg,
                bottomSpacing: BrandSpacing.xl,
                horizontalPadding: BrandSpacing.lg,
              }}
              topInsetTone="sheet"
              keyboardShouldPersistTaps="handled"
            >
              <Box flex={1} gap="lg">
                {errorMessage ? (
                  <NoticeBanner
                    tone="error"
                    message={errorMessage}
                    onDismiss={() => setErrorMessage(null)}
                    borderColor={theme.color.danger}
                    backgroundColor={theme.color.dangerSubtle}
                    textColor={theme.color.danger}
                    iconColor={theme.color.danger}
                  />
                ) : null}
                {statusMessage ? (
                  <NoticeBanner
                    tone="success"
                    message={statusMessage}
                    onDismiss={() => setStatusMessage(null)}
                    borderColor={theme.color.success}
                    backgroundColor={theme.color.successSubtle}
                    textColor={theme.color.text}
                    iconColor={theme.color.success}
                  />
                ) : null}
                {studioJobs.length === 0 ? (
                  <View style={{ minHeight: 320, justifyContent: "center" }}>
                    <EmptyState icon="bag" title={t("jobsTab.emptyStudio")} body="" />
                  </View>
                ) : filteredStudioJobs.length === 0 ? (
                  <View style={{ minHeight: 260, justifyContent: "center" }}>
                    <EmptyState
                      icon="briefcase.fill"
                      title={t("jobsTab.studioFeed.noJobsTitle")}
                      body={t("jobsTab.studioFeed.tryDifferentLane")}
                    />
                  </View>
                ) : shouldSplitBoard ? (
                  <View style={styles.sectionStack}>
                    <View style={styles.sectionBlock}>
                      <JobsSectionHeader
                        title={t("jobsTab.studioFeed.needsReviewTitle")}
                        subtitle={t("jobsTab.studioFeed.mobileDecisionWaiting", {
                          count: reviewQueueJobs.length,
                        })}
                      />
                      <StudioJobsList
                        jobs={reviewQueueJobs}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        reviewingApplicationId={isReviewingApplicationId}
                        payingJobId={isStartingCheckoutForJobId}
                        onInstructorPress={handleInstructorPress}
                        onReview={handleReviewApplication}
                        onStartPayment={handleStartPayment}
                        onStartNativeWalletPayment={handleStartNativeWalletPayment}
                        onStartEmbeddedCheckout={handleStartEmbeddedCheckout}
                        onJobPress={handleJobPress}
                        t={t}
                      />
                    </View>

                    <View style={styles.sectionBlock}>
                      <JobsSectionHeader title={t("jobsTab.studioFeed.boardTitle")} />
                      <StudioJobsList
                        jobs={boardJobs}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        reviewingApplicationId={isReviewingApplicationId}
                        payingJobId={isStartingCheckoutForJobId}
                        onInstructorPress={handleInstructorPress}
                        onReview={handleReviewApplication}
                        onStartPayment={handleStartPayment}
                        onStartNativeWalletPayment={handleStartNativeWalletPayment}
                        onStartEmbeddedCheckout={handleStartEmbeddedCheckout}
                        onJobPress={handleJobPress}
                        t={t}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.sectionBlock}>
                    <JobsSectionHeader
                      title={primarySectionTitle}
                      subtitle={primarySectionSubtitle}
                    />
                    {primaryJobs.length > 0 ? (
                      <StudioJobsList
                        jobs={primaryJobs}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        reviewingApplicationId={isReviewingApplicationId}
                        payingJobId={isStartingCheckoutForJobId}
                        onInstructorPress={handleInstructorPress}
                        onReview={handleReviewApplication}
                        onStartPayment={handleStartPayment}
                        onStartNativeWalletPayment={handleStartNativeWalletPayment}
                        onStartEmbeddedCheckout={handleStartEmbeddedCheckout}
                        onJobPress={handleJobPress}
                        t={t}
                      />
                    ) : (
                      <View style={{ minHeight: 220, justifyContent: "center" }}>
                        <EmptyState
                          icon="checkmark.circle"
                          title={t("jobsTab.boardEmptyTitle")}
                          body={t("jobsTab.boardEmptyBody")}
                        />
                      </View>
                    )}
                  </View>
                )}
              </Box>
            </TabScreenScrollView>

            {/* Multi-FAB */}
            <TabOverlayAnchor side="right" offset={BrandSpacing.lg}>
              <VStack align="end" gap="sm">
                {isFabMenuOpen && (
                  <Animated.View entering={FadeInUp.springify().damping(Spring.gentle.damping)}>
                    <VStack gap="sm" align="end">
                      <HStack gap="sm" align="center">
                        <Box
                          backgroundColor="surfaceElevated"
                          px="md"
                          py="xs"
                          style={{ borderRadius: BrandRadius.button }}
                        >
                          <Text variant="labelStrong" color="text">
                            Archive
                          </Text>
                        </Box>
                        <IconButton
                          accessibilityLabel={t("jobsTab.archiveTitle")}
                          onPress={() => {
                            setIsFabMenuOpen(false);
                            archiveSheetRef.current?.expand();
                          }}
                          tone="primary"
                          size={48}
                          icon={
                            <IconSymbol
                              name="archivebox.fill"
                              size={18}
                              color={theme.color.onPrimary}
                            />
                          }
                        />
                      </HStack>

                      <HStack gap="sm" align="center">
                        <Box
                          backgroundColor="surfaceElevated"
                          px="md"
                          py="xs"
                          style={{ borderRadius: BrandRadius.button }}
                        >
                          <Text variant="labelStrong" color="text">
                            Post Job
                          </Text>
                        </Box>
                        <IconButton
                          accessibilityLabel={t("jobsTab.actions.post")}
                          disabled={!areStudioBranchesReady}
                          onPress={() => {
                            setIsFabMenuOpen(false);
                            setIsCreateSheetVisible(true);
                            createJobSheetRef.current?.expand();
                          }}
                          tone="primary"
                          size={48}
                          icon={<IconSymbol name="plus" size={18} color={theme.color.onPrimary} />}
                        />
                      </HStack>
                    </VStack>
                  </Animated.View>
                )}

                <IconButton
                  accessibilityLabel={isFabMenuOpen ? t("common.close") : t("jobsTab.actions.post")}
                  disabled={!areStudioBranchesReady && !isFabMenuOpen}
                  onPress={() => {
                    if (areStudioBranchesReady) {
                      setIsFabMenuOpen((current) => !current);
                    }
                  }}
                  tone="primary"
                  size={58}
                  icon={
                    <IconSymbol
                      name={isFabMenuOpen ? "xmark" : "plus"}
                      size={22}
                      color={theme.color.onPrimary}
                    />
                  }
                />
              </VStack>
            </TabOverlayAnchor>

            {isFocused && areStudioBranchesReady ? (
              <CreateJobSheet
                innerRef={createJobSheetRef as never}
                isSubmitting={isSubmittingStudio}
                onDismissed={() => setIsCreateSheetVisible(false)}
                onPost={postStudioJob}
                defaultBranchId={defaultBranchId}
              />
            ) : null}

            {isFocused ? (
              <StudioJobDetailSheet
                innerRef={detailSheetRef as never}
                job={
                  selectedJobId
                    ? (filteredStudioJobsWithPayments.find(
                        (j) => String(j.jobId) === selectedJobId,
                      ) ?? null)
                    : null
                }
                locale={locale}
                zoneLanguage={zoneLanguage}
                onDismiss={() => {
                  setSelectedJobId(null);
                  detailSheetRef.current?.close();
                }}
                onReview={(applicationId, status) => {
                  void handleReviewApplication(applicationId as any, status);
                }}
                reviewingApplicationId={isReviewingApplicationId}
                onInstructorPress={handleInstructorPress}
              />
            ) : null}

            {isFocused ? (
              <StudioJobsArchiveSheet
                innerRef={archiveSheetRef as never}
                onDismissed={() => {}}
                jobs={pastJobs}
                locale={locale}
                zoneLanguage={zoneLanguage}
              />
            ) : null}

            {embeddedCheckoutDetails ? (
              <StripeEmbeddedCheckoutSheet
                visible={embeddedCheckoutVisible}
                checkout={embeddedCheckoutDetails}
                onClose={() => {
                  setEmbeddedCheckoutVisible(false);
                  setEmbeddedCheckoutDetails(null);
                }}
                onCompleted={() => {
                  setEmbeddedCheckoutVisible(false);
                  setEmbeddedCheckoutDetails(null);
                  setStatusMessage(t("jobsTab.checkout.completed"));
                }}
              />
            ) : null}
          </Animated.View>
        )}
      </Box>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    gap: BrandSpacing.lg,
  },
  sectionStack: {
    gap: BrandSpacing.lg,
  },
  sectionBlock: {
    gap: BrandSpacing.md,
  },
  emptyStateWrap: {
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.lg + BrandSpacing.xs,
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm + BrandSpacing.xxs,
  },
});
