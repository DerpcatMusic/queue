import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import { CreateJobSheet } from "@/components/jobs/studio/create-job-sheet";
import type BottomSheet from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { KitButton } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/empty-state";
import { BrandSpacing } from "@/constants/brand";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useBrand } from "@/hooks/use-brand";
import {
  MINUTE_MS,
  DEVICE_TIME_ZONE,
  trimOptional,
  type StudioDraft,
} from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as WebBrowser from "expo-web-browser";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

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

  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";

  const currentUser = useQuery(api.users.getCurrentUser);

  const postJob = useMutation(api.jobs.postJob);
  const reviewApplication = useMutation(api.jobs.reviewApplication);
  const updateStudioNotificationSettings = useMutation(api.users.updateMyStudioNotificationSettings);
  const createCheckoutForJob = useAction(api.rapyd.createCheckoutForJob);

  const studioJobs = useQuery(
    api.jobs.getMyStudioJobsWithApplications,
    currentUser?.role === "studio" ? { limit: 80 } : "skip",
  );

  const studioNotificationSettings = useQuery(
    api.users.getMyStudioNotificationSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );
  const studioPayments = useQuery(
    api.payments.listMyPayments,
    currentUser?.role === "studio" ? { limit: 200 } : "skip",
  );

  const createJobSheetRef = useRef<BottomSheet>(null);
  const [isSubmittingStudio, setIsSubmittingStudio] = useState(false);
  const [isEnablingStudioPush, setIsEnablingStudioPush] = useState(false);
  const [isReviewingApplicationId, setIsReviewingApplicationId] = useState<Id<"jobApplications"> | null>(null);
  const [isStartingCheckoutForJobId, setIsStartingCheckoutForJobId] = useState<Id<"jobs"> | null>(null);
  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsStatusFilter, setJobsStatusFilter] = useState<
    "all" | "needs_review" | "open" | "filled" | "completed"
  >("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const studioJobsStartedAtRef = useRef<number | null>(null);

  const filteredStudioJobs = useMemo(() => {
    const search = jobsSearchQuery.trim().toLowerCase();
    return (studioJobs ?? []).filter((job) => {
      if (jobsStatusFilter === "needs_review" && job.pendingApplicationsCount === 0) {
        return false;
      }
      if (
        jobsStatusFilter !== "all" &&
        jobsStatusFilter !== "needs_review" &&
        job.status !== jobsStatusFilter
      ) {
        return false;
      }

      if (!search) return true;
      const applicants = job.applications.map((application) => application.instructorName).join(" ");
      const haystack = `${job.zone} ${toSportLabel(job.sport as never)} ${applicants}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [studioJobs, jobsSearchQuery, jobsStatusFilter]);
  const latestPaymentByJobId = useMemo(() => {
    const map = new Map<
      string,
      {
        paymentId: Id<"payments">;
        status: "created" | "pending" | "authorized" | "captured" | "failed" | "cancelled" | "refunded";
        payoutStatus:
          | "queued"
          | "processing"
          | "pending_provider"
          | "paid"
          | "failed"
          | "cancelled"
          | "needs_attention"
          | null;
      }
    >();
    for (const row of studioPayments ?? []) {
      const key = String(row.payment.jobId);
      if (map.has(key)) continue;
      map.set(key, {
        paymentId: row.payment._id,
        status: row.payment.status,
        payoutStatus: row.payout?.status ?? null,
      });
    }
    return map;
  }, [studioPayments]);
  const filteredStudioJobsWithPayments = useMemo(
    () =>
      filteredStudioJobs.map((job) => ({
        ...job,
        payment: latestPaymentByJobId.get(String(job.jobId)) ?? null,
      })),
    [filteredStudioJobs, latestPaymentByJobId],
  );

  useEffect(() => {
    if (!FEATURE_FLAGS.jobsPerfTelemetry) return;
    return () => {
      logPerfSummary();
    };
  }, []);

  useEffect(() => {
    if (!FEATURE_FLAGS.jobsPerfTelemetry) return;
    if (studioJobs === undefined) {
      if (studioJobsStartedAtRef.current === null) {
        studioJobsStartedAtRef.current = performance.now();
      }
      return;
    }

    if (studioJobsStartedAtRef.current !== null) {
      recordPerfMetric(
        "jobs.studio.jobs_with_applications_query",
        performance.now() - studioJobsStartedAtRef.current,
      );
      studioJobsStartedAtRef.current = null;
    }
  }, [studioJobs]);


  if (currentUser === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (currentUser.role !== "instructor" && currentUser.role !== "studio") {
    return <Redirect href="/" />;
  }


  const postStudioJob = async (draft: StudioDraft) => {
    if (currentUser.role !== "studio") return;
    const stopTimer = FEATURE_FLAGS.jobsPerfTelemetry
      ? createPerfTimer("jobs.studio.post_job_mutation")
      : null;
    const referenceNow = Date.now();

    const pay = Number.parseFloat(draft.payInput);
    if (!Number.isFinite(pay) || pay <= 0) {
      setErrorMessage(t("jobsTab.errors.payRequired"));
      return;
    }

    if (draft.startTime <= referenceNow) {
      setErrorMessage(t("jobsTab.errors.startMustBeFuture"));
      return;
    }

    if (draft.endTime <= draft.startTime) {
      setErrorMessage(t("jobsTab.errors.endMustBeAfterStart"));
      return;
    }

    const applicationDeadline =
      draft.startTime - draft.applicationLeadMinutes * MINUTE_MS;
    
    // Safety check for absolute minimum lead time (15 mins) if not specified
    const finalApplicationDeadline = Math.min(applicationDeadline, draft.startTime - (15 * MINUTE_MS));

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingStudio(true);

    try {
      const note = trimOptional(draft.note);
      await postJob({
        sport: draft.sport,
        startTime: draft.startTime,
        endTime: draft.endTime,
        timeZone: DEVICE_TIME_ZONE,
        pay,
        maxParticipants: draft.maxParticipants,
        cancellationDeadlineHours: draft.cancellationDeadlineHours,
        applicationDeadline: finalApplicationDeadline,
        ...omitUndefined({ note }),
      });

      setStatusMessage(t("jobsTab.success.posted"));
      createJobSheetRef.current?.close();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToPost");
      setErrorMessage(message);
    } finally {
      stopTimer?.();
      setIsSubmittingStudio(false);
    }
  };



  const reviewStudioApplication = async (
    applicationId: Id<"jobApplications">,
    status: "accepted" | "rejected",
  ) => {
    if (currentUser.role !== "studio") return;
    const stopTimer = FEATURE_FLAGS.jobsPerfTelemetry
      ? createPerfTimer("jobs.studio.review_application_mutation")
      : null;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsReviewingApplicationId(applicationId);

    try {
      await reviewApplication({ applicationId, status });
      setStatusMessage(
        status === "accepted"
          ? t("jobsTab.success.accepted")
          : t("jobsTab.success.rejected"),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToReview");
      setErrorMessage(message);
    } finally {
      stopTimer?.();
      setIsReviewingApplicationId(null);
    }
  };

  const enableStudioPush = async () => {
    if (currentUser.role !== "studio") return;

    setIsEnablingStudioPush(true);
    setErrorMessage(null);

    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        throw new Error(t("jobsTab.errors.pushPermissionRequired"));
      }

      await updateStudioNotificationSettings({
        notificationsEnabled: true,
        expoPushToken: token,
      });
      setStatusMessage(t("jobsTab.success.pushEnabled"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToEnablePush");
      setErrorMessage(message);
    } finally {
      setIsEnablingStudioPush(false);
    }
  };

  const startStudioCheckout = async (jobId: Id<"jobs">) => {
    if (currentUser.role !== "studio") return;

    setIsStartingCheckoutForJobId(jobId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const checkout = await createCheckoutForJob({
        jobId,
      });
      await WebBrowser.openBrowserAsync(checkout.checkoutUrl);
      setStatusMessage(t("jobsTab.success.checkoutOpened"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToStartCheckout");
      setErrorMessage(message);
    } finally {
      setIsStartingCheckoutForJobId(null);
    }
  };



  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
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
              <View
                style={[styles.section, { borderBottomColor: palette.border }]}
              >
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
              <View style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.sm, paddingBottom: BrandSpacing.sm }}>
                <TextInput
                  value={jobsSearchQuery}
                  onChangeText={setJobsSearchQuery}
                  placeholder="Search jobs"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipGrid}
                >
                  {[
                    { key: "all", label: "All jobs" },
                    { key: "needs_review", label: "Needs review" },
                    { key: "open", label: "Open" },
                    { key: "filled", label: "Filled" },
                    { key: "completed", label: "Completed" },
                  ].map((option) => {
                    const selected = jobsStatusFilter === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? palette.primary : palette.border,
                            backgroundColor: selected ? palette.primarySubtle : palette.surface,
                          },
                        ]}
                        onPress={() => {
                          setJobsStatusFilter(
                            option.key as "all" | "needs_review" | "open" | "filled" | "completed",
                          );
                        }}
                      >
                        <ThemedText
                          type="micro"
                          style={{ color: selected ? palette.primary : palette.textMuted }}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
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
                  <EmptyState
                    icon="bag"
                    title={t("jobsTab.emptyStudio")}
                    body=""
                  />
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

      <CreateJobSheet
        innerRef={createJobSheetRef as never}
        palette={palette}
        isSubmitting={isSubmittingStudio}
        onClose={() => createJobSheetRef.current?.close()}
        onPost={postStudioJob}
      />
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
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    fontSize: 15,
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

