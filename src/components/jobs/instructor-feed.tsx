import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isSportType, toSportLabel } from "@/convex/constants";
import { InstructorArchiveSheet } from "@/components/jobs/instructor/instructor-archive-sheet";
import { InstructorNeedsDoneList } from "@/components/jobs/instructor/instructor-needs-done-list";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { LoadingScreen } from "@/components/loading-screen";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitFab } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import {
  createPerfTimer,
  logPerfSummary,
  recordPerfMetric,
} from "@/lib/perf-telemetry";
import {
  clearLessonReminder,
  getLessonReminder,
  setLessonReminder,
} from "@/lib/lesson-reminders";
import {
  formatDateTime,
  formatCompactDateTime,
  formatRelativeDuration,
  getLessonProgress,
  getMonotonicNow,
  LessonLifecycle,
  ReminderMap,
  ClockAnchor,
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
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from "react-native";

type HeroMetric = {
  label: string;
  value: number;
};

type FeedHeroProps = {
  title: string;
  subtitle: string;
  metrics: HeroMetric[];
  palette: ReturnType<typeof useBrand>;
};

function FeedHero({ title, subtitle, metrics, palette }: FeedHeroProps) {
  return (
    <View style={styles.heroWrap}>
      <ThemedText type="micro" style={{ color: palette.textMuted }}>
        {subtitle}
      </ThemedText>
      <ThemedText
        type="heading"
        style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1.1, fontWeight: "800" }}
      >
        {title}
      </ThemedText>
      <View style={styles.heroMetricsRow}>
        {metrics.map((metric, index) => (
          <View key={`${metric.label}-${index}`} style={styles.heroMetricCol}>
            <ThemedText
              selectable
              style={{
                color: palette.text,
                fontSize: 24,
                lineHeight: 28,
                letterSpacing: -0.6,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {metric.value >= 100 ? "99+" : String(metric.value)}
            </ThemedText>
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              {metric.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

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
  const [reminderByJobId, setReminderByJobId] = useState<ReminderMap>({});
  const [isReminderBusyJobId, setIsReminderBusyJobId] = useState<string | null>(
    null,
  );
  const [isMarkingDoneJobId, setIsMarkingDoneJobId] = useState<string | null>(
    null,
  );
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
    if (!isFocused || currentUser?.role !== "instructor" || !myApplications) {
      return;
    }

    let cancelled = false;
    const loadReminders = async () => {
      const referenceNow = serverNow?.now ?? Date.now() + clockOffsetMs;
      const accepted = myApplications.filter(
        (row) => row.status === "accepted" && row.endTime > referenceNow,
      );
      const entries = await Promise.all(
        accepted.map(async (row) => {
          const reminder = await getLessonReminder(String(row.jobId));
          return [String(row.jobId), reminder] as const;
        }),
      );

      if (cancelled) return;

      const nextState: ReminderMap = {};
      for (const [jobId, reminder] of entries) {
        if (!reminder) continue;
        nextState[jobId] = {
          triggerAt: reminder.triggerAt,
          leadMinutes: reminder.leadMinutes,
          startTime: reminder.startTime,
        };
      }
      setReminderByJobId(nextState);
    };

    void loadReminders();
    return () => {
      cancelled = true;
    };
  }, [clockOffsetMs, currentUser?.role, isFocused, myApplications, serverNow]);

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

  const liveSessions = instructorSessions.filter((row) => row.lifecycle === "live");
  const upcomingSessions = instructorSessions.filter(
    (row) => row.lifecycle === "upcoming",
  );
  const needsDoneSessions = instructorSessions.filter(
    (row) => row.lifecycle === "needs_done",
  );
  const archivedSessions = [...instructorSessions]
    .filter((row) => row.endTime <= now || row.lifecycle === "completed")
    .sort((a, b) => b.endTime - a.endTime);
  const focusSession = liveSessions[0] ?? upcomingSessions[0] ?? null;
  const focusProgress = focusSession
    ? focusSession.lifecycle === "upcoming"
      ? 0
      : getLessonProgress(now, focusSession.startTime, focusSession.endTime)
    : 0;
  const focusTimingLabel = focusSession
    ? focusSession.lifecycle === "live"
      ? `${formatRelativeDuration(focusSession.endTime - now)} left`
      : `${formatRelativeDuration(focusSession.startTime - now)} to start`
    : null;
  const focusWindowLabel = focusSession
    ? `${formatDateTime(focusSession.startTime, locale)} - ${formatCompactDateTime(
        focusSession.endTime,
        locale,
      )}`
    : null;
  const nonAcceptedApplications = (myApplications ?? [])
    .filter((row) => row.status !== "accepted")
    .sort((a, b) => b.appliedAt - a.appliedAt);
  const openJobsCount = availableJobs?.length ?? 0;
  const nextSessionCount = upcomingSessions.length + liveSessions.length;

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


  const toggleLessonReminder = async (session: {
    jobId: Id<"jobs">;
    sport: string;
    studioName: string;
    startTime: number;
  }) => {
    const key = String(session.jobId);
    setIsReminderBusyJobId(key);
    setErrorMessage(null);

    try {
      if (reminderByJobId[key]) {
        await clearLessonReminder(key);
        setReminderByJobId((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        return;
      }

      const reminder = await setLessonReminder({
        jobId: key,
        sportLabel: isSportType(session.sport)
          ? toSportLabel(session.sport)
          : session.sport,
        studioName: session.studioName,
        startTime: session.startTime,
        leadMinutes: 30,
      });
      setReminderByJobId((current) => ({
        ...current,
        [key]: {
          triggerAt: reminder.triggerAt,
          leadMinutes: reminder.leadMinutes,
          startTime: reminder.startTime,
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToSetReminder");
      setErrorMessage(message);
    } finally {
      setIsReminderBusyJobId(null);
    }
  };

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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={currentUser.role === "instructor" ? [1] : undefined}
      >
        <View>
          <View style={{ paddingHorizontal: BrandSpacing.lg, paddingTop: 8 }}>
            <FeedHero
              title={t("jobsTab.title")}
              subtitle={t("jobsTab.instructorSubtitle")}
              palette={palette}
              metrics={[
                {
                  label: t("jobsTab.availableJobsTitle"),
                  value: openJobsCount,
                },
                {
                  label: t("jobsTab.currentLessonTitle"),
                  value: nextSessionCount,
                },
                {
                  label: t("jobsTab.notificationsTitle"),
                  value: nonAcceptedApplications.length,
                },
              ]}
            />
          </View>

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
          <View
            style={[
              styles.focusStickyWrap,
              {
                borderBottomColor: palette.border,
                backgroundColor: palette.surfaceAlt,
              },
            ]}
          >
            {focusSession ? (
              <View
                style={[
                  styles.lessonSheet,
                  {
                    borderBottomColor: palette.border,
                    backgroundColor: palette.surfaceAlt,
                  },
                ]}
              >
                <View style={styles.lessonHeader}>
                  <View style={styles.lessonCopy}>
                    <ThemedText type="micro" style={{ color: palette.textMuted }}>
                      {focusSession.lifecycle === "live"
                        ? t("jobsTab.currentLessonTitle")
                        : t("jobsTab.instructorSessionsTitle")}
                    </ThemedText>
                    <ThemedText type="subtitle">
                      {toSportLabel(focusSession.sport as never)}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {focusSession.studioName}
                    </ThemedText>
                  </View>
                  <View style={styles.lessonMeta}>
                    <ThemedText style={styles.lessonTimingText}>
                      {focusTimingLabel}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {focusSession.lifecycle === "live"
                        ? t("jobsTab.liveBadge")
                        : t("jobsTab.upcomingBadge")}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  selectable
                  style={{ color: palette.textMuted, fontVariant: ["tabular-nums"] }}
                >
                  {focusWindowLabel}
                </ThemedText>
                <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(focusProgress * 100)}%`,
                        backgroundColor: palette.success,
                      },
                    ]}
                  />
                </View>
                {focusSession.lifecycle === "upcoming" ? (
                  <Pressable
                    style={[styles.compactAction, { borderColor: palette.borderStrong }]}
                    onPress={() => {
                      void toggleLessonReminder(focusSession);
                    }}
                    disabled={isReminderBusyJobId === String(focusSession.jobId)}
                  >
                    <ThemedText type="defaultSemiBold">
                      {isReminderBusyJobId === String(focusSession.jobId)
                        ? t("jobsTab.actions.updatingReminder")
                        : reminderByJobId[String(focusSession.jobId)]
                          ? t("jobsTab.actions.clearReminder")
                          : t("jobsTab.actions.setReminder")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.lessonSheet} />
            )}
          </View>
        ) : null}



        {currentUser.role === "instructor" ? (
          <>
            <FeedSectionHeader
              title={t("jobsTab.needsDoneTitle", { count: needsDoneSessions.length })}
              subtitle={t("jobsTab.instructorSessionsTitle")}
              palette={palette}
            />

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
              ) : (
                <InstructorOpenJobsList
                  jobs={availableJobs}
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
      </ScrollView>

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
              name="archive"
              size={24}
              color={archivedSessions.length > 0 ? palette.onPrimary : palette.textMuted}
            />
          }
          style={[
            styles.archiveFab,
            {
              bottom: 24,
              [isRtl ? "left" : "right"]: 16,
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






