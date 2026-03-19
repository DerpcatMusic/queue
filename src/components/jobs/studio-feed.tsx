import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import {
  type StudioJobsStatusFilter,
  useStudioFeedController,
} from "@/components/jobs/studio/use-studio-feed-controller";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { KitChip, KitSurface } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

type FeedSectionHeaderProps = {
  title: string;
  subtitle?: string;
  palette: ReturnType<typeof useBrand>;
};

type StudioFeedJobSummary = {
  pendingApplicationsCount: number;
  status: string;
};

function FeedSectionHeader({ title, subtitle, palette }: FeedSectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="meta" style={{ color: palette.textMuted }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function StudioFeed() {
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const palette = useBrand();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const signInRoute = "/sign-in" as const;
  const onboardingRoute = "/onboarding" as const;
  const instructorJobsRoute = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
  const {
    createJobSheetRef,
    currentUser,
    enableStudioPush,
    errorMessage,
    filteredStudioJobs,
    filteredStudioJobsWithPayments,
    isEnablingStudioPush,
    isReviewingApplicationId,
    isStartingCheckoutForJobId,
    isSubmittingStudio,
    jobsSearchQuery,
    jobsStatusFilter,
    postStudioJob,
    reviewStudioApplication,
    setErrorMessage,
    setJobsSearchQuery,
    setJobsStatusFilter,
    setStatusMessage,
    startStudioCheckout,
    statusMessage,
    studioJobs,
    studioNotificationSettings,
  } = useStudioFeedController({ t });
  const reviewCount =
    studioJobs?.reduce(
      (total: number, job: StudioFeedJobSummary) => total + job.pendingApplicationsCount,
      0,
    ) ?? 0;
  const openCount =
    studioJobs?.filter((job: StudioFeedJobSummary) => job.status === "open").length ?? 0;
  const filledCount =
    studioJobs?.filter((job: StudioFeedJobSummary) => job.status === "filled").length ?? 0;
  const reviewQueueJobs = filteredStudioJobsWithPayments.filter(
    (job: StudioFeedJobSummary) => job.pendingApplicationsCount > 0,
  );
  const boardJobs = filteredStudioJobsWithPayments.filter(
    (job: StudioFeedJobSummary) => job.pendingApplicationsCount === 0,
  );
  const filterOptions = [
    {
      key: "all",
      label: t("jobsTab.studioFeed.filterAll"),
    },
    {
      key: "needs_review",
      label: t("jobsTab.studioFeed.filterNeedsReview"),
    },
    { key: "open", label: t("jobsTab.studioFeed.filterOpen") },
    { key: "filled", label: t("jobsTab.studioFeed.filterFilled") },
    { key: "completed", label: t("jobsTab.studioFeed.filterCompleted") },
  ] as const;
  const shouldSplitBoard =
    jobsStatusFilter === "all" && reviewQueueJobs.length > 0 && boardJobs.length > 0;
  const primaryJobs =
    jobsStatusFilter === "needs_review" ? reviewQueueJobs : filteredStudioJobsWithPayments;
  const primarySectionShowsReviewQueue =
    jobsStatusFilter === "needs_review" ||
    (jobsStatusFilter === "all" && reviewQueueJobs.length > 0 && boardJobs.length === 0);
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

  const jobsSheetConfig = useMemo(
    () => ({
      content: (
        <View style={styles.noticeStack}>
          <NativeSearchField
            value={jobsSearchQuery}
            onChangeText={setJobsSearchQuery}
            placeholder={t("jobsTab.searchPlaceholder", {
              defaultValue: "Search jobs",
            })}
            clearAccessibilityLabel={t("common.clear")}
          />
          <ThemedText type="sectionTitle" style={{ color: palette.onPrimary as string }}>
            {t("jobsTab.studioFeed.title")}
          </ThemedText>
          <ThemedText type="meta" style={{ color: palette.onPrimary as string, opacity: 0.76 }}>
            {[
              `${t("jobsTab.studioFeed.metricReview")}: ${String(reviewCount)}`,
              `${t("jobsTab.studioFeed.metricOpen")}: ${String(openCount)}`,
              `${t("jobsTab.studioFeed.metricFilled")}: ${String(filledCount)}`,
            ].join("  •  ")}
          </ThemedText>
          {errorMessage ? (
            <NoticeBanner
              tone="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
              borderColor="transparent"
              backgroundColor={palette.dangerSubtle}
              textColor={palette.danger}
              iconColor={palette.danger}
            />
          ) : null}
          {statusMessage ? (
            <NoticeBanner
              tone="success"
              message={statusMessage}
              onDismiss={() => setStatusMessage(null)}
              borderColor="transparent"
              backgroundColor={palette.successSubtle}
              textColor={palette.text}
              iconColor={palette.success as import("react-native").ColorValue}
            />
          ) : null}
        </View>
      ),
      padding: {
        vertical: BrandSpacing.lg,
        horizontal: BrandSpacing.xl,
      },
      steps: [0.26],
      initialStep: 0,
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    }),
    [
      errorMessage,
      filledCount,
      jobsSearchQuery,
      openCount,
      palette,
      reviewCount,
      setJobsSearchQuery,
      setStatusMessage,
      setErrorMessage,
      statusMessage,
      t,
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
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="studio/jobs/index"
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: collapsedSheetHeight + BrandSpacing.lg,
            paddingHorizontal: BrandSpacing.lg,
          },
        ]}
        topInsetTone="sheet"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
          <KitSurface tone="sheet" padding={BrandSpacing.lg} gap={BrandSpacing.md}>
            <View style={styles.controlHeader}>
              <ThemedText type="meta" style={{ color: palette.textMuted as string }}>
                {[
                  `${t("jobsTab.studioFeed.metricReview")}: ${String(reviewCount)}`,
                  `${t("jobsTab.studioFeed.metricOpen")}: ${String(openCount)}`,
                  `${t("jobsTab.studioFeed.metricFilled")}: ${String(filledCount)}`,
                ].join("  •  ")}
              </ThemedText>

              <View style={styles.actionRow}>
                <ActionButton
                  label={t("jobsTab.form.title", "Post New Job")}
                  onPress={() => createJobSheetRef.current?.expand()}
                  palette={palette}
                />
                {reviewCount > 0 ? (
                  <ActionButton
                    label={t("jobsTab.studioFeed.reviewAction", {
                      count: reviewCount,
                    })}
                    onPress={() => setJobsStatusFilter("needs_review")}
                    palette={palette}
                    tone="secondary"
                  />
                ) : null}
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipGrid}
            >
              {filterOptions.map((option) => (
                <KitChip
                  key={option.key}
                  label={option.label}
                  selected={jobsStatusFilter === option.key}
                  onPress={() => {
                    setJobsStatusFilter(option.key as StudioJobsStatusFilter);
                  }}
                />
              ))}
            </ScrollView>
          </KitSurface>

          {studioNotificationSettings != null && !studioNotificationSettings.hasExpoPushToken ? (
            <KitSurface tone="sheet" padding={BrandSpacing.lg} gap={BrandSpacing.md}>
              <FeedSectionHeader
                title={t("jobsTab.notificationsTitle")}
                subtitle={t("jobsTab.studioPushDescription")}
                palette={palette}
              />
              <ActionButton
                label={
                  isEnablingStudioPush
                    ? t("jobsTab.actions.enablingPush")
                    : t("jobsTab.actions.enablePush")
                }
                palette={palette}
                tone="secondary"
                onPress={() => {
                  void enableStudioPush();
                }}
                disabled={isEnablingStudioPush}
              />
            </KitSurface>
          ) : null}

          {studioJobs === undefined ? (
            <View style={[styles.emptyStateWrap, { minHeight: 300 }]}>
              <ActivityIndicator
                size="small"
                color={palette.primary as import("react-native").ColorValue}
              />
              <ThemedText
                style={{
                  color: palette.textMuted,
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
                icon="magnifyingglass"
                title={t("jobsTab.noJobsFound")}
                body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
              />
            </View>
          ) : shouldSplitBoard ? (
            <View style={styles.sectionStack}>
              <KitSurface tone="sheet" padding={BrandSpacing.lg} gap={BrandSpacing.md}>
                <FeedSectionHeader
                  title={t("jobsTab.studioFeed.needsReviewTitle")}
                  subtitle={t("jobsTab.studioFeed.mobileDecisionWaiting", {
                    count: reviewQueueJobs.length,
                  })}
                  palette={palette}
                />
                <StudioJobsList
                  jobs={reviewQueueJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  reviewingApplicationId={isReviewingApplicationId}
                  payingJobId={isStartingCheckoutForJobId}
                  onReview={(applicationId, status) => {
                    void reviewStudioApplication(applicationId, status);
                  }}
                  onStartPayment={(jobId) => {
                    void startStudioCheckout(jobId);
                  }}
                  t={t}
                />
              </KitSurface>

              <KitSurface tone="sheet" padding={BrandSpacing.lg} gap={BrandSpacing.md}>
                <FeedSectionHeader
                  title={t("jobsTab.studioFeed.boardTitle")}
                  subtitle={t("jobsTab.studioFeed.boardSubtitle", {
                    count: boardJobs.length,
                  })}
                  palette={palette}
                />
                <StudioJobsList
                  jobs={boardJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  reviewingApplicationId={isReviewingApplicationId}
                  payingJobId={isStartingCheckoutForJobId}
                  onReview={(applicationId, status) => {
                    void reviewStudioApplication(applicationId, status);
                  }}
                  onStartPayment={(jobId) => {
                    void startStudioCheckout(jobId);
                  }}
                  t={t}
                />
              </KitSurface>
            </View>
          ) : (
            <KitSurface tone="sheet" padding={BrandSpacing.lg} gap={BrandSpacing.md}>
              <FeedSectionHeader
                title={primarySectionTitle}
                subtitle={primarySectionSubtitle}
                palette={palette}
              />
              {primaryJobs.length > 0 ? (
                <StudioJobsList
                  jobs={primaryJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  reviewingApplicationId={isReviewingApplicationId}
                  payingJobId={isStartingCheckoutForJobId}
                  onReview={(applicationId, status) => {
                    void reviewStudioApplication(applicationId, status);
                  }}
                  onStartPayment={(jobId) => {
                    void startStudioCheckout(jobId);
                  }}
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
            </KitSurface>
          )}
        </View>
      </TabScreenScrollView>

      {isFocused ? (
        <CreateJobSheet
          innerRef={createJobSheetRef as never}
          palette={palette}
          isSubmitting={isSubmittingStudio}
          onClose={() => createJobSheetRef.current?.close()}
          onPost={postStudioJob}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: BrandSpacing.xl,
  },
  page: {
    flex: 1,
    gap: BrandSpacing.lg,
  },
  noticeStack: {
    gap: BrandSpacing.sm,
  },
  sectionHeader: {
    gap: 2,
  },
  controlHeader: {
    gap: BrandSpacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionStack: {
    gap: BrandSpacing.lg,
  },
  emptyStateWrap: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  chipGrid: {
    flexDirection: "row",
    gap: 8,
  },
});
