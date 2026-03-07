import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import {
  type StudioJobsStatusFilter,
  useStudioFeedController,
} from "@/components/jobs/studio/use-studio-feed-controller";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitButton, KitChip } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

type FeedSectionHeaderProps = {
  title: string;
  subtitle?: string;
  palette: ReturnType<typeof useBrand>;
};

function FeedSectionHeader({ title, subtitle, palette }: FeedSectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="title">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function StudioFeed() {
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const isWideWeb = Platform.OS === "web" && width >= 1180;
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
  const screenStyle = useMemo(
    () => StyleSheet.flatten([styles.screen, { backgroundColor: palette.appBg }]),
    [palette.appBg],
  );
  const reviewCount =
    studioJobs?.reduce((total, job) => total + job.pendingApplicationsCount, 0) ?? 0;
  const openCount = studioJobs?.filter((job) => job.status === "open").length ?? 0;
  const filledCount = studioJobs?.filter((job) => job.status === "filled").length ?? 0;
  const reviewQueueJobs = filteredStudioJobsWithPayments.filter(
    (job) => job.pendingApplicationsCount > 0,
  );
  const boardJobs = filteredStudioJobsWithPayments.filter(
    (job) => job.pendingApplicationsCount === 0,
  );
  const filterOptions = [
    {
      key: "all",
      label: t("jobsTab.filters.allJobs", { defaultValue: "All jobs" }),
    },
    {
      key: "needs_review",
      label: t("jobsTab.filters.needsReview", { defaultValue: "Needs review" }),
    },
    { key: "open", label: "Active" },
    { key: "filled", label: "Filled" },
    { key: "completed", label: "Completed" },
  ] as const;
  const shouldSplitMobileBoard =
    jobsStatusFilter === "all" && reviewQueueJobs.length > 0 && boardJobs.length > 0;
  const mobilePrimaryJobs =
    jobsStatusFilter === "needs_review" ? reviewQueueJobs : filteredStudioJobsWithPayments;

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

  if (isWideWeb) {
    return (
      <View style={screenStyle}>
        <TabScreenScrollView
          routeKey="studio/jobs/index"
          style={styles.screen}
          contentContainerStyle={{
            paddingHorizontal: BrandSpacing.xl,
            paddingTop: BrandSpacing.xl,
            paddingBottom: BrandSpacing.xxl,
            gap: BrandSpacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: "row", gap: BrandSpacing.xl, alignItems: "stretch" }}>
            <View
              style={{
                flex: 1.2,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 22,
                paddingVertical: 22,
                gap: 12,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.8,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                }}
              >
                Studio operations
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 42,
                  lineHeight: 40,
                  letterSpacing: -1,
                  color: palette.onPrimary as string,
                }}
              >
                Work the queue without losing the board
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.onPrimary as string,
                  opacity: 0.9,
                  maxWidth: 620,
                }}
              >
                Web now treats review, posting, and active jobs as one operating desk instead of a
                stretched phone feed.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <KitButton
                  label={t("jobsTab.form.title", "Post New Job")}
                  icon="plus"
                  onPress={() => createJobSheetRef.current?.expand()}
                  variant="secondary"
                  fullWidth={false}
                  style={{ backgroundColor: palette.onPrimary as string }}
                />
                <KitButton
                  label={reviewCount > 0 ? `${String(reviewCount)} awaiting review` : "Queue clear"}
                  onPress={() => setJobsStatusFilter("needs_review")}
                  variant="secondary"
                  fullWidth={false}
                  style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
                />
              </View>
            </View>

            <View
              style={{
                width: 340,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                paddingHorizontal: 18,
                paddingVertical: 18,
                gap: 14,
              }}
            >
              {[
                { label: "Review", value: reviewCount, accent: palette.primary as string },
                { label: "Open", value: openCount, accent: palette.text as string },
                { label: "Filled", value: filledCount, accent: palette.success as string },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    borderRadius: 24,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface as string,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {metric.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "BarlowCondensed_800ExtraBold",
                      fontSize: 30,
                      lineHeight: 28,
                      color: metric.accent,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {String(metric.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {errorMessage ? (
            <NoticeBanner
              tone="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
              borderColor={palette.borderStrong}
              backgroundColor={palette.surface}
              textColor={palette.danger}
              iconColor={palette.danger}
            />
          ) : null}

          {statusMessage ? (
            <NoticeBanner
              tone="success"
              message={statusMessage}
              onDismiss={() => setStatusMessage(null)}
              borderColor={palette.borderStrong}
              backgroundColor={palette.surface}
              textColor={palette.text}
              iconColor={palette.success as import("react-native").ColorValue}
            />
          ) : null}

          <View style={{ flexDirection: "row", gap: BrandSpacing.xl, alignItems: "flex-start" }}>
            <View style={{ flex: 1.35, gap: BrandSpacing.xl, minWidth: 0 }}>
              {reviewQueueJobs.length > 0 ? (
                <View
                  style={{
                    borderRadius: 32,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface as string,
                    paddingVertical: 18,
                    gap: 12,
                  }}
                >
                  <View style={{ paddingHorizontal: 18 }}>
                    <FeedSectionHeader
                      title="Needs review"
                      subtitle={
                        reviewQueueJobs.length === 1
                          ? "1 job has applicants waiting for a decision."
                          : `${String(reviewQueueJobs.length)} jobs have applicants waiting for a decision.`
                      }
                      palette={palette}
                    />
                  </View>
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
                </View>
              ) : null}

              <View
                style={{
                  borderRadius: 32,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingVertical: 18,
                  gap: 12,
                }}
              >
                <View style={{ paddingHorizontal: 18 }}>
                  <FeedSectionHeader
                    title="Board"
                    subtitle={
                      boardJobs.length === 1
                        ? "1 job sits outside the review lane."
                        : `${String(boardJobs.length)} jobs sit outside the review lane.`
                    }
                    palette={palette}
                  />
                </View>

                {studioJobs === undefined ? (
                  <View style={[styles.emptyStateWrap, { minHeight: 320 }]}>
                    <ActivityIndicator
                      size="small"
                      color={palette.primary as import("react-native").ColorValue}
                    />
                    <ThemedText style={{ color: palette.textMuted, marginTop: BrandSpacing.xs }}>
                      {t("jobsTab.loading")}
                    </ThemedText>
                  </View>
                ) : studioJobs.length === 0 ? (
                  <View style={{ flex: 1, minHeight: 360, justifyContent: "center" }}>
                    <EmptyState icon="bag" title={t("jobsTab.emptyStudio")} body="" />
                  </View>
                ) : filteredStudioJobs.length === 0 ? (
                  <View style={{ flex: 1, minHeight: 260, justifyContent: "center" }}>
                    <EmptyState
                      icon="magnifyingglass"
                      title={t("jobsTab.noJobsFound")}
                      body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
                    />
                  </View>
                ) : boardJobs.length > 0 ? (
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
                ) : (
                  <View style={{ flex: 1, minHeight: 240, justifyContent: "center" }}>
                    <EmptyState
                      icon="checkmark.circle"
                      title="Nothing outside review"
                      body="Your remaining jobs are all in the review queue above."
                    />
                  </View>
                )}
              </View>
            </View>

            <View style={{ width: 320, gap: 16 }}>
              <View
                style={{
                  borderRadius: 30,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  gap: 12,
                }}
              >
                <FeedSectionHeader
                  title="Filter desk"
                  subtitle="Route the board without shrinking the working lane."
                  palette={palette}
                />
                <NativeSearchField
                  value={jobsSearchQuery}
                  onChangeText={setJobsSearchQuery}
                  placeholder={t("jobsTab.searchPlaceholder", { defaultValue: "Search jobs" })}
                  clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
                />
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
              </View>

              {studioNotificationSettings !== undefined &&
              !studioNotificationSettings?.hasExpoPushToken ? (
                <View
                  style={{
                    borderRadius: 30,
                    borderCurve: "continuous",
                    backgroundColor: palette.surfaceAlt as string,
                    paddingHorizontal: 18,
                    paddingVertical: 18,
                    gap: 10,
                  }}
                >
                  <FeedSectionHeader
                    title={t("jobsTab.notificationsTitle")}
                    subtitle={t("jobsTab.studioPushDescription")}
                    palette={palette}
                  />
                  <KitButton
                    label={
                      isEnablingStudioPush
                        ? t("jobsTab.actions.enablingPush")
                        : t("jobsTab.actions.enablePush")
                    }
                    variant="secondary"
                    onPress={() => {
                      void enableStudioPush();
                    }}
                    disabled={isEnablingStudioPush}
                  />
                </View>
              ) : null}

              <View
                style={{
                  borderRadius: 30,
                  borderCurve: "continuous",
                  backgroundColor: palette.surfaceAlt as string,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  gap: 8,
                }}
              >
                <Text style={{ ...BrandType.heading, fontSize: 24, color: palette.text as string }}>
                  Workflow
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  Review stays detailed only while a decision is needed. The board compresses once a
                  job is staffed or settled, so web reads like an operations desk instead of a long
                  mobile feed.
                </Text>
              </View>
            </View>
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

  return (
    <View style={screenStyle}>
      <TabScreenScrollView
        routeKey="studio/jobs/index"
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          {/* Header removed from Jobs Tab for minimalism */}

          {errorMessage ? (
            <View style={styles.noticeWrap}>
              <NoticeBanner
                tone="error"
                message={errorMessage}
                onDismiss={() => setErrorMessage(null)}
                borderColor={palette.borderStrong}
                backgroundColor={palette.surface}
                textColor={palette.danger}
                iconColor={palette.danger}
              />
            </View>
          ) : null}

          {statusMessage ? (
            <View style={styles.noticeWrap}>
              <NoticeBanner
                tone="success"
                message={statusMessage}
                onDismiss={() => setStatusMessage(null)}
                borderColor={palette.borderStrong}
                backgroundColor={palette.surface}
                textColor={palette.text}
                iconColor={palette.success as import("react-native").ColorValue}
              />
            </View>
          ) : null}
        </View>

        {currentUser.role === "studio" ? (
          <>
            <View
              style={{ paddingHorizontal: BrandSpacing.lg, paddingTop: BrandSpacing.lg, gap: 10 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  borderRadius: BrandRadius.card,
                  borderCurve: "continuous",
                  backgroundColor: palette.surfaceAlt as string,
                  padding: 14,
                }}
              >
                {[
                  {
                    label: "Open",
                    value: String(studioJobs?.filter((job) => job.status === "open").length ?? 0),
                    accent: palette.primary as string,
                  },
                  {
                    label: "Review",
                    value: String(
                      studioJobs?.reduce((total, job) => total + job.pendingApplicationsCount, 0) ??
                        0,
                    ),
                  },
                  {
                    label: "Filled",
                    value: String(studioJobs?.filter((job) => job.status === "filled").length ?? 0),
                    accent: palette.success as string,
                  },
                ].map((item, index) => (
                  <View key={item.label} style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.title,
                        color: item.accent ?? (palette.text as string),
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {item.value}
                    </Text>
                    {index < 2 ? (
                      <View
                        style={{
                          position: "absolute",
                          right: -5,
                          top: 4,
                          bottom: 4,
                          width: 1,
                          backgroundColor: palette.appBg as string,
                        }}
                      />
                    ) : null}
                  </View>
                ))}
              </View>

              <View
                style={{
                  borderRadius: BrandRadius.card,
                  borderCurve: "continuous",
                  backgroundColor: palette.primary as string,
                  padding: 18,
                  gap: 14,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.onPrimary as string,
                      opacity: 0.78,
                    }}
                  >
                    COMMAND
                  </Text>
                  <Text
                    style={{
                      ...BrandType.heading,
                      fontSize: 30,
                      lineHeight: 32,
                      color: palette.onPrimary as string,
                    }}
                  >
                    {jobsStatusFilter === "needs_review"
                      ? "Work the applicant queue"
                      : "Post fast, fill faster"}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.onPrimary as string,
                      opacity: 0.9,
                    }}
                  >
                    Create shifts, review applicants, and move payment work from one lane.
                  </Text>
                </View>
                <KitButton
                  label={t("jobsTab.form.title", "Post New Job")}
                  icon="plus"
                  onPress={() => createJobSheetRef.current?.expand()}
                  variant="secondary"
                  fullWidth={false}
                  style={{ backgroundColor: palette.onPrimary as string }}
                />
              </View>
            </View>

            {studioNotificationSettings !== undefined &&
            !studioNotificationSettings?.hasExpoPushToken ? (
              <View style={[styles.section, { borderBottomColor: "transparent" }]}>
                <FeedSectionHeader
                  title={t("jobsTab.notificationsTitle")}
                  subtitle={t("jobsTab.studioPushDescription")}
                  palette={palette}
                />
                <View style={styles.settingRow}>
                  <View style={styles.settingCopy}>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("jobsTab.studioPushDescription")}
                    </ThemedText>
                  </View>
                  <KitButton
                    label={
                      isEnablingStudioPush
                        ? t("jobsTab.actions.enablingPush")
                        : t("jobsTab.actions.enablePush")
                    }
                    variant="secondary"
                    onPress={() => {
                      void enableStudioPush();
                    }}
                    disabled={isEnablingStudioPush}
                  />
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1, paddingTop: BrandSpacing.md }}>
              <FeedSectionHeader
                title={
                  shouldSplitMobileBoard
                    ? "Review lane and board"
                    : jobsStatusFilter === "needs_review"
                      ? "Needs review"
                      : t("jobsTab.studioFeedTitle")
                }
                subtitle={
                  shouldSplitMobileBoard
                    ? "Handle waiting applicants first, then scan the remaining board."
                    : jobsStatusFilter === "needs_review"
                      ? "Only jobs with pending applicants are shown."
                      : t("jobsTab.studioApplicationsTitle")
                }
                palette={palette}
              />
              <View
                style={{
                  paddingHorizontal: BrandSpacing.lg,
                  gap: BrandSpacing.sm,
                  paddingBottom: BrandSpacing.sm,
                }}
              >
                <NativeSearchField
                  value={jobsSearchQuery}
                  onChangeText={setJobsSearchQuery}
                  placeholder={t("jobsTab.searchPlaceholder", { defaultValue: "Search jobs" })}
                  clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipGrid}
                >
                  {filterOptions.map((option) => {
                    const selected = jobsStatusFilter === option.key;
                    return (
                      <KitChip
                        key={option.key}
                        label={option.label}
                        selected={selected}
                        onPress={() => {
                          setJobsStatusFilter(option.key as StudioJobsStatusFilter);
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </View>
              {studioJobs === undefined ? (
                <View style={[styles.emptyStateWrap, { minHeight: 300 }]}>
                  <ActivityIndicator
                    size="small"
                    color={palette.primary as import("react-native").ColorValue}
                  />
                  <ThemedText style={{ color: palette.textMuted, marginTop: BrandSpacing.xs }}>
                    {t("jobsTab.loading")}
                  </ThemedText>
                </View>
              ) : studioJobs.length === 0 ? (
                <View style={{ flex: 1, minHeight: 400, justifyContent: "center" }}>
                  <EmptyState icon="bag" title={t("jobsTab.emptyStudio")} body="" />
                </View>
              ) : filteredStudioJobs.length === 0 ? (
                <View style={{ flex: 1, minHeight: 260, justifyContent: "center" }}>
                  <EmptyState
                    icon="magnifyingglass"
                    title={t("jobsTab.noJobsFound")}
                    body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
                  />
                </View>
              ) : shouldSplitMobileBoard ? (
                <View style={{ gap: BrandSpacing.md }}>
                  <View style={{ gap: BrandSpacing.xs }}>
                    <FeedSectionHeader
                      title="Needs review"
                      subtitle={
                        reviewQueueJobs.length === 1
                          ? "1 job is waiting for a decision."
                          : `${String(reviewQueueJobs.length)} jobs are waiting for a decision.`
                      }
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
                  </View>

                  <View style={{ gap: BrandSpacing.xs }}>
                    <FeedSectionHeader
                      title="Board"
                      subtitle={
                        boardJobs.length === 1
                          ? "1 job sits outside the review lane."
                          : `${String(boardJobs.length)} jobs sit outside the review lane.`
                      }
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
                  </View>
                </View>
              ) : (
                <StudioJobsList
                  jobs={mobilePrimaryJobs}
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
              )}
            </View>
          </>
        ) : null}
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
  },
  noticeWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroWrap: {
    gap: 8,
    paddingBottom: 8,
  },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroMetricCol: {
    flex: 1,
    gap: 2,
  },
  sectionHeader: {
    gap: 2,
  },
  section: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  formStepSection: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    padding: 12,
    gap: 10,
  },
  formStepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  formStepBadge: {
    minWidth: 36,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionBlock: {
    gap: 10,
  },
  compactAction: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  lessonSheet: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  focusStickyWrap: {
    zIndex: 2,
  },
  snapshotSection: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  snapshotTile: {
    minWidth: 120,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  snapshotValue: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  lessonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  lessonCopy: {
    flex: 1,
    gap: 2,
  },
  lessonMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  lessonTimingText: {
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  jobsFeed: {
    borderBottomWidth: 1,
  },
  jobsFeedHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emptyStateWrap: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyStateText: {
    textAlign: "center",
  },
  jobRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  jobPrimaryCopy: {
    flex: 1,
    gap: 2,
  },
  jobFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowActionButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    gap: 8,
  },
  archiveCopy: {
    flex: 1,
    gap: 2,
  },
  feedRow: {
    paddingTop: 12,
    gap: 8,
  },
  applicationRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeCardRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  inlinePickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 10,
    gap: 8,
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  stepperButton: {
    minWidth: 38,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  stepperValue: {
    minWidth: 36,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  jobHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
});
