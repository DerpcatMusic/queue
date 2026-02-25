import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { InstructorArchiveSheet } from "@/components/jobs/instructor/instructor-archive-sheet";
import { InstructorNeedsDoneList } from "@/components/jobs/instructor/instructor-needs-done-list";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { LoadingScreen } from "@/components/loading-screen";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitFab } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import {
  createPerfTimer,
  logPerfSummary,
  recordPerfMetric,
} from "@/lib/perf-telemetry";

import {
  getMonotonicNow,
  type LessonLifecycle,
  type ClockAnchor,
  MINUTE_MS,
} from "@/lib/jobs-utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  StyleSheet,
  View,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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



export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const isRtl = I18nManager.isRTL;
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const isFocused = useIsFocused();

  const currentUser = useQuery(api.users.getCurrentUser);

  const applyToJob = useMutation(api.jobs.applyToJob);
  const markLessonCompleted = useMutation(api.jobs.markLessonCompleted);
  const queryMinuteBucket = Math.floor(Date.now() / MINUTE_MS);
  const availableJobsNow = queryMinuteBucket * MINUTE_MS;

  const serverNow = useQuery(
    api.jobs.getServerNow,
    currentUser?.role === "instructor" && isFocused
      ? { minuteBucket: queryMinuteBucket }
      : "skip",
  );

  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" && isFocused
      ? { limit: 50, now: availableJobsNow }
      : "skip",
  );
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    currentUser?.role === "instructor" && isFocused ? { limit: 80 } : "skip",
  );
  const [isApplyingToJobId, setIsApplyingToJobId] = useState<Id<"jobs"> | null>(
    null,
  );
  const archiveSheetRef = useRef<BottomSheet>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [clockAnchor, setClockAnchor] = useState<ClockAnchor | null>(null);
  const [now, setNow] = useState(() => Date.now());


  const [isMarkingDoneJobId, setIsMarkingDoneJobId] = useState<string | null>(
    null,
  );
  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsWindowFilter, setJobsWindowFilter] = useState<"all" | "24h" | "72h">("all");
  const [hasShownNoSessionsToast, setHasShownNoSessionsToast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const availableJobsStartedAtRef = useRef<number | null>(null);
  const applicationsStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (serverNow?.now === undefined) return;
    setClockOffsetMs(serverNow.now - Date.now());
    const monotonicNow = getMonotonicNow();
    if (monotonicNow === null) {
      setClockAnchor(null);
      return;
    }
    setClockAnchor({
      serverNow: serverNow.now,
      monotonicNow,
    });
  }, [serverNow?.now]);

  useEffect(() => {
    if (!isFocused) return;
    const updateNow = () => {
      if (clockAnchor) {
        const monotonicNow = getMonotonicNow();
        if (monotonicNow !== null) {
          setNow(clockAnchor.serverNow + (monotonicNow - clockAnchor.monotonicNow));
          return;
        }
      }
      setNow(Date.now() + clockOffsetMs);
    };
    updateNow();
    const timer = setInterval(updateNow, 1_000);
    return () => {
      clearInterval(timer);
    };
  }, [clockAnchor, clockOffsetMs, isFocused]);



  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 4200);
    return () => {
      clearTimeout(timer);
    };
  }, [statusMessage]);

  useEffect(() => {
    if (!FEATURE_FLAGS.jobsPerfTelemetry) return;
    return () => {
      logPerfSummary();
    };
  }, []);

  useEffect(() => {
    if (!FEATURE_FLAGS.jobsPerfTelemetry) return;
    if (availableJobs === undefined) {
      if (availableJobsStartedAtRef.current === null) {
        availableJobsStartedAtRef.current = performance.now();
      }
      return;
    }
    if (availableJobsStartedAtRef.current !== null) {
      recordPerfMetric(
        "jobs.instructor.available_jobs_query",
        performance.now() - availableJobsStartedAtRef.current,
      );
      availableJobsStartedAtRef.current = null;
    }
  }, [availableJobs]);

  useEffect(() => {
    if (!FEATURE_FLAGS.jobsPerfTelemetry) return;
    if (myApplications === undefined) {
      if (applicationsStartedAtRef.current === null) {
        applicationsStartedAtRef.current = performance.now();
      }
      return;
    }
    if (applicationsStartedAtRef.current !== null) {
      recordPerfMetric(
        "jobs.instructor.my_applications_query",
        performance.now() - applicationsStartedAtRef.current,
      );
      applicationsStartedAtRef.current = null;
    }
  }, [myApplications]);

  useEffect(() => {
    if (currentUser?.role !== "instructor" || myApplications === undefined) {
      return;
    }

    const hasAccepted = myApplications.some((row) => row.status === "accepted");
    if (!hasAccepted && !hasShownNoSessionsToast) {
      setStatusMessage(t("jobsTab.emptySessions"));
      setHasShownNoSessionsToast(true);
      return;
    }

    if (hasAccepted && hasShownNoSessionsToast) {
      setHasShownNoSessionsToast(false);
    }
  }, [
    currentUser?.role,
    hasShownNoSessionsToast,
    myApplications,
    t,
  ]);

  const instructorSessions = useMemo(() => {
    if (currentUser?.role !== "instructor" || !myApplications) {
      return [];
    }

    return myApplications
      .filter((row) => row.status === "accepted")
      .map((row) => ({
        ...row,
        lifecycle: (() => {
          if (row.jobStatus === "completed" || row.jobStatus === "cancelled") {
            return "completed" as LessonLifecycle;
          }
          if (now >= row.endTime) {
            return "needs_done" as LessonLifecycle;
          }
          if (now >= row.startTime) {
            return "live" as LessonLifecycle;
          }
          return "upcoming" as LessonLifecycle;
        })(),
      }))
      .sort((a, b) => a.startTime - b.startTime);
  }, [currentUser?.role, myApplications, now]);


  const needsDoneSessions = instructorSessions.filter(
    (row) => row.lifecycle === "needs_done",
  );
  const archivedSessions = [...instructorSessions]
    .filter((row) => row.endTime <= now || row.lifecycle === "completed")
    .sort((a, b) => b.endTime - a.endTime);

  const nonAcceptedApplications = (myApplications ?? [])
    .filter((row) => row.status !== "accepted")
    .sort((a, b) => b.appliedAt - a.appliedAt);

  const filteredAvailableJobs = useMemo(() => {
    const search = jobsSearchQuery.trim().toLowerCase();
    const nowRef = now;
    return (availableJobs ?? []).filter((job) => {
      if (jobsWindowFilter === "24h" && job.startTime > nowRef + 24 * 60 * 60 * 1000) {
        return false;
      }
      if (jobsWindowFilter === "72h" && job.startTime > nowRef + 72 * 60 * 60 * 1000) {
        return false;
      }

      if (!search) return true;
      const zoneLabel = getZoneLabel(job.zone, zoneLanguage).toLowerCase();
      const sportLabel = toSportLabel(job.sport as never).toLowerCase();
      const haystack = `${job.studioName} ${job.note ?? ""} ${job.zone} ${zoneLabel} ${sportLabel}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [availableJobs, jobsSearchQuery, jobsWindowFilter, now, zoneLanguage]);

  const applyForJob = async (jobId: Id<"jobs">) => {
    if (currentUser?.role !== "instructor") return;
    const stopTimer = FEATURE_FLAGS.jobsPerfTelemetry
      ? createPerfTimer("jobs.instructor.apply_mutation")
      : null;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsApplyingToJobId(jobId);

    try {
      await applyToJob({ jobId });
      setStatusMessage(t("jobsTab.success.applied"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToApply");
      setErrorMessage(message);
    } finally {
      stopTimer?.();
      setIsApplyingToJobId(null);
    }
  };

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



  const markLessonDone = async (jobId: Id<"jobs">) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsMarkingDoneJobId(String(jobId));
    try {
      await markLessonCompleted({ jobId });
      setStatusMessage(t("jobsTab.success.lessonCompleted"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToMarkLessonDone");
      setErrorMessage(message);
    } finally {
      setIsMarkingDoneJobId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View>

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





        {currentUser.role === "instructor" ? (
          <FeedSectionHeader
            title={t("jobsTab.needsDoneTitle", { count: needsDoneSessions.length })}
            subtitle={t("jobsTab.instructorSessionsTitle")}
            palette={palette}
          />
        ) : null}

        {currentUser.role === "instructor" ? (
          <>
            <InstructorNeedsDoneList
              sessions={needsDoneSessions}
              locale={locale}
              palette={palette}
              markBusyJobId={isMarkingDoneJobId}
              onMarkDone={(jobId) => {
                void markLessonDone(jobId);
              }}
              t={t}
            />
            <View style={{ flex: 1, paddingTop: BrandSpacing.md }}>
              <FeedSectionHeader
                title={t("jobsTab.availableJobsTitle")}
                subtitle={t("jobsTab.timezoneHint", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                palette={palette}
              />
              <View style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.sm, paddingBottom: BrandSpacing.sm }}>
                <TextInput
                  value={jobsSearchQuery}
                  onChangeText={setJobsSearchQuery}
                  placeholder={t("jobsTab.searchPlaceholder")}
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
                <View style={styles.chipGrid}>
                  {[
                    { key: "all", label: t("jobsTab.filters.anyTime") },
                    { key: "24h", label: t("jobsTab.filters.next24h") },
                    { key: "72h", label: t("jobsTab.filters.next72h") },
                  ].map((option) => {
                    const selected = jobsWindowFilter === option.key;
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
                          setJobsWindowFilter(option.key as "all" | "24h" | "72h");
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
                </View>
              </View>

              {availableJobs === undefined ? (
                <View style={[styles.emptyStateWrap, { minHeight: 260 }]}>
                  <ThemedText style={[styles.emptyStateText, { color: palette.textMuted }]}>
                    {t("jobsTab.loading")}
                  </ThemedText>
                </View>
              ) : availableJobs.length === 0 ? (
                <View style={{ minHeight: 260, justifyContent: "center" }}>
                  <EmptyState
                    icon="briefcase"
                    title={t("jobsTab.emptyInstructor")}
                    body=""
                  />
                </View>
              ) : filteredAvailableJobs.length === 0 ? (
                <View style={{ minHeight: 220, justifyContent: "center", paddingHorizontal: BrandSpacing.lg }}>
                  <EmptyState
                    icon="magnifyingglass"
                    title={t("jobsTab.noJobsFound")}
                    body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
                  />
                </View>
              ) : (
                <InstructorOpenJobsList
                  jobs={filteredAvailableJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  applyingJobId={isApplyingToJobId}
                  onApply={(jobId) => {
                    void applyForJob(jobId);
                  }}
                  t={t}
                />
              )}
            </View>

            {nonAcceptedApplications.length > 0 ? (
              <View style={{ paddingHorizontal: BrandSpacing.lg, paddingVertical: BrandSpacing.md }}>
                <ThemedText style={{ color: palette.textMuted, textAlign: "center" }}>
                  {t("jobsTab.applicationSummary", {
                    count: nonAcceptedApplications.length,
                  })}
                </ThemedText>
              </View>
            ) : null}
          </>
        ) : null}
      </TabScreenScrollView>

      {currentUser.role === "instructor" ? (
        <KitFab
          key={`archive-fab-${resolvedScheme}`}
          selected={archivedSessions.length > 0}
          disabled={archivedSessions.length === 0}
          {...(archivedSessions.length > 0
            ? { badgeLabel: String(archivedSessions.length) }
            : {})}
          icon={
            <MaterialIcons
              name="history"
              size={24}
              color={archivedSessions.length > 0 ? palette.onPrimary : palette.textMuted}
            />
          }
          style={[
            styles.archiveFab,
            {
              bottom: Math.max(insets.bottom, 24),
              [isRtl ? "left" : "right"]: BrandSpacing.lg,
            },
          ]}
          onPress={() => {
            if (archivedSessions.length === 0) return;
            archiveSheetRef.current?.expand();
          }}
        />
      ) : null}

      {currentUser.role === "instructor" ? (
        <InstructorArchiveSheet
          sheetRef={archiveSheetRef}
          sessions={archivedSessions}
          locale={locale}
          palette={palette}
          resolvedScheme={resolvedScheme}
          t={t}
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
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.md,
    paddingBottom: BrandSpacing.xs,
    gap: 2,
  },
  section: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
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
    fontWeight: "700",
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
    fontWeight: "600",
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
  archiveFab: {
    position: "absolute",
    zIndex: 12,
  },
});






