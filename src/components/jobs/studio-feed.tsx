import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
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
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

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

  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const signInRoute = "/sign-in" as const;
  const onboardingRoute = "/onboarding" as const;
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

  if (currentUser === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href={signInRoute} />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href={onboardingRoute} />;
  }

  if (currentUser.role !== "instructor" && currentUser.role !== "studio") {
    return <Redirect href={onboardingRoute} />;
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
            {studioNotificationSettings !== undefined &&
            !studioNotificationSettings?.hasExpoPushToken ? (
              <View style={[styles.section, { borderBottomColor: palette.border }]}>
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

            <View style={[styles.section, { borderBottomColor: palette.border }]}>
              <FeedSectionHeader
                title={t("jobsTab.studioCreateTitle")}
                subtitle={t("jobsTab.studioSubtitle")}
                palette={palette}
              />

              <View style={{ marginTop: 12 }}>
                <KitButton
                  label={t("jobsTab.form.title", "Post New Job")}
                  icon="plus"
                  onPress={() => createJobSheetRef.current?.expand()}
                />
              </View>
            </View>

            <View style={{ flex: 1, paddingTop: BrandSpacing.md }}>
              <FeedSectionHeader
                title={t("jobsTab.studioFeedTitle")}
                subtitle={t("jobsTab.studioApplicationsTitle")}
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
                  {[
                    {
                      key: "all",
                      label: t("jobsTab.filters.allJobs", { defaultValue: "All jobs" }),
                    },
                    {
                      key: "needs_review",
                      label: t("jobsTab.filters.needsReview", { defaultValue: "Needs review" }),
                    },
                    { key: "open", label: t("jobsTab.filters.open", { defaultValue: "Open" }) },
                    {
                      key: "filled",
                      label: t("jobsTab.filters.filled", { defaultValue: "Filled" }),
                    },
                    {
                      key: "completed",
                      label: t("jobsTab.filters.completed", { defaultValue: "Completed" }),
                    },
                  ].map((option) => {
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
                  <ThemedText style={{ color: palette.textMuted }}>
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
              ) : (
                <StudioJobsList
                  jobs={filteredStudioJobsWithPayments}
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
