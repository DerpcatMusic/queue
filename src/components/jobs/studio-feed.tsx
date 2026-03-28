import type BottomSheet from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { JobsSectionHeader } from "@/components/jobs/jobs-tab/jobs-section-header";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
import { StudioJobDetailSheet } from "@/components/jobs/studio/studio-job-detail-sheet";
import { StudioJobsArchiveSheet } from "@/components/jobs/studio/studio-jobs-archive-sheet";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import { StudioJobsTopSheetHeader } from "@/components/jobs/studio/studio-jobs-top-sheet";
import {
  type StudioJobsTimeFilter,
  useStudioFeedController,
} from "@/components/jobs/studio/use-studio-feed-controller";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import { Box, HStack, Text, VStack } from "@/primitives";

export function StudioFeed() {
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
  const detailSheetRef = useRef<BottomSheet>(null);
  const archiveSheetRef = useRef<BottomSheet>(null);

  // Expand sheet when job is selected (handle render timing)
  useEffect(() => {
    if (selectedJobId) {
      console.log("useEffect firing, selectedJobId:", selectedJobId);
      console.log("detailSheetRef.current:", detailSheetRef.current);
      // Use setTimeout to ensure sheet has mounted before expand
      const timer = setTimeout(() => {
        console.log("setTimeout callback, ref:", detailSheetRef.current);
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
    startStudioCheckout,
    statusMessage,
    studioBranches,
    studioJobs,
    studioNotificationSettings,
    toggleStudioPush,
  } = useStudioFeedController({ t });
  const defaultBranchId =
    studioBranches?.length === 1 ? (studioBranches[0]?.branchId ?? null) : null;
  const areStudioBranchesReady = studioBranches !== undefined;
  const now = Date.now();

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
    (filter: StudioJobsTimeFilter) => {
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
  const handleJobPress = useCallback(
    (jobId: string) => {
      console.log("handleJobPress called with:", jobId, "type:", typeof jobId);
      console.log("filteredStudioJobsWithPayments count:", filteredStudioJobsWithPayments.length);
      const firstJob = filteredStudioJobsWithPayments[0];
      if (firstJob) {
        console.log("First job jobId:", firstJob.jobId, "type:", typeof firstJob.jobId);
      }
      const found = filteredStudioJobsWithPayments.find((j) => String(j.jobId) === jobId);
      console.log("Found job:", found ? "yes" : "no", found?.sport);
      setSelectedJobId(jobId);
    },
    [filteredStudioJobsWithPayments],
  );

  const jobsSheetConfig = useMemo(
    () => ({
      stickyHeader: (
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
      steps: [0.12],
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      backgroundColor: theme.color.primary,
      topInsetColor: theme.color.primary,
    }),
    [
      handleChangeJobsFilter,
      handleToggleJobsFilters,
      isEnablingStudioPush,
      isFilterExpanded,
      jobsTimeFilter,
      studioNotificationSettings?.notificationsEnabled,
      t,
      theme.color.primary,
      toggleStudioPush,
    ],
  );

  useGlobalTopSheet("jobs", jobsSheetConfig);

  if (currentUser === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href={signInRoute} />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href={onboardingRoute} />;
  }

  if (currentUser.role === "instructor") {
    return <Redirect href={instructorJobsRoute} />;
  }

  if (currentUser.role !== "studio") {
    return <Redirect href={onboardingRoute} />;
  }

  return (
    <Box flex={1} style={{ backgroundColor: theme.jobs.canvas }}>
      <TabScreenScrollView
        routeKey="studio/jobs/index"
        style={styles.screen}
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
          {studioJobs === undefined ? (
            <View style={[styles.emptyStateWrap, { minHeight: 300 }]}>
              <ActivityIndicator size="small" color={theme.color.primary} />
              <ThemedText
                style={{
                  color: theme.color.textMuted,
                  marginTop: BrandSpacing.xs,
                }}
              >
                {t("jobsTab.loading")}
              </ThemedText>
            </View>
          ) : studioJobs.length === 0 ? (
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
                  onReview={handleReviewApplication}
                  onStartPayment={handleStartPayment}
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
                  onReview={handleReviewApplication}
                  onStartPayment={handleStartPayment}
                  onJobPress={handleJobPress}
                  t={t}
                />
              </View>
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <JobsSectionHeader title={primarySectionTitle} subtitle={primarySectionSubtitle} />
              {primaryJobs.length > 0 ? (
                <StudioJobsList
                  jobs={primaryJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  reviewingApplicationId={isReviewingApplicationId}
                  payingJobId={isStartingCheckoutForJobId}
                  onReview={handleReviewApplication}
                  onStartPayment={handleStartPayment}
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
          {/* Menu items - appear above main FAB with animation */}
          {isFabMenuOpen && (
            <Animated.View entering={FadeInUp.springify().damping(15)}>
              <VStack gap="sm" align="end">
                {/* Archive button with label */}
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
                      <IconSymbol name="archivebox.fill" size={18} color={theme.color.onPrimary} />
                    }
                  />
                </HStack>

                {/* Post Job button with label */}
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

          {/* Main FAB */}
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
              ? (filteredStudioJobsWithPayments.find((j) => String(j.jobId) === selectedJobId) ??
                null)
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
    </Box>
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
