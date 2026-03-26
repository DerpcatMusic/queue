import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { JobsSectionHeader } from "@/components/jobs/jobs-tab/jobs-section-header";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
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
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import { Box } from "@/primitives";

export function StudioFeed() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const [isCreateSheetVisible, setIsCreateSheetVisible] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
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
  const reviewQueueJobs = filteredStudioJobsWithPayments.filter(
    (job) => job.pendingApplicationsCount > 0,
  );
  const boardJobs = filteredStudioJobsWithPayments.filter(
    (job) => job.pendingApplicationsCount === 0,
  );
  const shouldSplitBoard = reviewQueueJobs.length > 0 && boardJobs.length > 0;
  const primaryJobs = filteredStudioJobsWithPayments;
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

      {!isCreateSheetVisible ? (
        <TabOverlayAnchor side="right" offset={BrandSpacing.lg}>
          <IconButton
            accessibilityLabel={t("jobsTab.actions.post")}
            disabled={!areStudioBranchesReady}
            onPress={() => {
              setIsCreateSheetVisible(true);
              createJobSheetRef.current?.expand();
            }}
            tone="primary"
            size={58}
            icon={<IconSymbol name="plus" size={22} color={theme.color.onPrimary} />}
          />
        </TabOverlayAnchor>
      ) : null}

      {isFocused && areStudioBranchesReady ? (
        <CreateJobSheet
          innerRef={createJobSheetRef as never}
          isSubmitting={isSubmittingStudio}
          onDismissed={() => setIsCreateSheetVisible(false)}
          onPost={postStudioJob}
          defaultBranchId={defaultBranchId}
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
