import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { BrandButton } from "@/components/ui/brand-button";
import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  clearLessonReminder,
  getLessonReminder,
  setLessonReminder,
} from "@/lib/lesson-reminders";
import { omitUndefined } from "@/lib/omit-undefined";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DateTimePickerAndroidLike = {
  open: (options: {
    value: Date;
    mode: "date" | "time";
    is24Hour?: boolean;
    timeZoneName?: string;
    onChange?: (event: unknown, date?: Date) => void;
  }) => void;
};

let NativeDateTimePicker: ComponentType<Record<string, unknown>> | null = null;
let NativeDateTimePickerAndroid: DateTimePickerAndroidLike | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pickerModule = require("@react-native-community/datetimepicker") as {
    default: ComponentType<Record<string, unknown>>;
    DateTimePickerAndroid?: DateTimePickerAndroidLike;
  };
  NativeDateTimePicker = pickerModule.default;
  NativeDateTimePickerAndroid = pickerModule.DateTimePickerAndroid ?? null;
} catch {
  NativeDateTimePicker = null;
  NativeDateTimePickerAndroid = null;
}

const MINUTE_MS = 60 * 1000;
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
const DURATION_PRESETS = [45, 60, 75, 90] as const;
const PAY_PRESETS = [180, 220, 260, 320] as const;
const CANCELLATION_PRESETS = [6, 12, 24, 48] as const;
const APPLICATION_LEAD_PRESETS = [30, 60, 120, 180] as const;
const MAX_PARTICIPANTS_MIN = 1;
const MAX_PARTICIPANTS_MAX = 40;

const JOB_STATUS_TRANSLATION_KEYS = {
  open: "jobsTab.status.job.open",
  filled: "jobsTab.status.job.filled",
  cancelled: "jobsTab.status.job.cancelled",
  completed: "jobsTab.status.job.completed",
} as const;

const APPLICATION_STATUS_TRANSLATION_KEYS = {
  pending: "jobsTab.status.application.pending",
  accepted: "jobsTab.status.application.accepted",
  rejected: "jobsTab.status.application.rejected",
  withdrawn: "jobsTab.status.application.withdrawn",
} as const;

function getApplicationStatusTranslationKey(status: string) {
  const key = status as keyof typeof APPLICATION_STATUS_TRANSLATION_KEYS;
  return (
    APPLICATION_STATUS_TRANSLATION_KEYS[key] ??
    APPLICATION_STATUS_TRANSLATION_KEYS.pending
  );
}

type PickerTarget = "start" | "end";
type LessonLifecycle = "live" | "upcoming" | "needs_done" | "completed";

type StudioDraft = {
  sport: string;
  startTime: number;
  endTime: number;
  payInput: string;
  note: string;
  maxParticipants: number;
  cancellationDeadlineHours: number;
  applicationLeadMinutes: number;
};

type ReminderMap = Record<
  string,
  {
    triggerAt: number;
    leadMinutes: number;
    startTime: number;
  }
>;

type ClockAnchor = {
  serverNow: number;
  monotonicNow: number;
};

function sanitizeDecimalInput(value: string): string {
  const stripped = value.replace(/[^0-9.]/g, "");
  const parts = stripped.split(".");
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function createDefaultStudioDraft(): StudioDraft {
  const startTime = Date.now() + 90 * MINUTE_MS;
  return {
    sport: "",
    startTime,
    endTime: startTime + 60 * MINUTE_MS,
    payInput: "250",
    note: "",
    maxParticipants: 12,
    cancellationDeadlineHours: 24,
    applicationLeadMinutes: 60,
  };
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDateTime(value: number, locale: string, timeZone = DEVICE_TIME_ZONE) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function getJobStatusTone(status: keyof typeof JOB_STATUS_TRANSLATION_KEYS) {
  if (status === "open") return "primary";
  if (status === "filled" || status === "completed") return "success";
  return "muted";
}

function formatCompactDateTime(
  value: number,
  locale: string,
  timeZone = DEVICE_TIME_ZONE,
) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRelativeDuration(ms: number) {
  const safeMs = Math.max(ms, 0);
  const roundedMinutes = Math.max(1, Math.round(safeMs / MINUTE_MS));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getLessonProgress(now: number, startTime: number, endTime: number) {
  if (endTime <= startTime) return 0;
  return clamp((now - startTime) / (endTime - startTime), 0, 1);
}

function getMonotonicNow() {
  const value = globalThis.performance?.now?.();
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  selectedBorderColor: string;
  selectedBackgroundColor: string;
  selectedTextColor: string;
};

function OptionChip({
  label,
  selected,
  onPress,
  borderColor,
  selectedBorderColor,
  selectedBackgroundColor,
  selectedTextColor,
}: OptionChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        {
          borderColor: selected ? selectedBorderColor : borderColor,
          backgroundColor: selected ? selectedBackgroundColor : undefined,
        },
      ]}
      onPress={onPress}
    >
      <ThemedText
        type="defaultSemiBold"
        style={{ color: selected ? selectedTextColor : undefined }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function JobsTabScreen() {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const locale = i18n.resolvedLanguage ?? "en";

  const currentUser = useQuery(api.users.getCurrentUser);

  const postJob = useMutation(api.jobs.postJob);
  const applyToJob = useMutation(api.jobs.applyToJob);
  const reviewApplication = useMutation(api.jobs.reviewApplication);
  const markLessonCompleted = useMutation(api.jobs.markLessonCompleted);
  const updateStudioNotificationSettings = useMutation(
    api.users.updateMyStudioNotificationSettings,
  );
  const queryMinuteBucket = Math.floor(Date.now() / MINUTE_MS);
  const availableJobsNow = queryMinuteBucket * MINUTE_MS;

  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor"
      ? { limit: 50, now: availableJobsNow }
      : "skip",
  );
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    currentUser?.role === "instructor" ? { limit: 80 } : "skip",
  );
  const studioJobs = useQuery(
    api.jobs.getMyStudioJobsWithApplications,
    currentUser?.role === "studio" ? { limit: 80 } : "skip",
  );
  const serverNow = useQuery(api.jobs.getServerNow, {
    minuteBucket: queryMinuteBucket,
  });
  const serverNowValue = serverNow?.now;
  const studioNotificationSettings = useQuery(
    api.users.getMyStudioNotificationSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );

  const [studioDraft, setStudioDraft] = useState<StudioDraft>(
    createDefaultStudioDraft(),
  );
  const [iosPickerTarget, setIosPickerTarget] = useState<PickerTarget | null>(
    null,
  );
  const [isSubmittingStudio, setIsSubmittingStudio] = useState(false);
  const [isApplyingToJobId, setIsApplyingToJobId] = useState<Id<"jobs"> | null>(
    null,
  );
  const [isReviewingApplicationId, setIsReviewingApplicationId] = useState<
    Id<"jobApplications"> | null
  >(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [clockAnchor, setClockAnchor] = useState<ClockAnchor | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [reminderByJobId, setReminderByJobId] = useState<ReminderMap>({});
  const [isReminderBusyJobId, setIsReminderBusyJobId] = useState<string | null>(
    null,
  );
  const [isMarkingDoneJobId, setIsMarkingDoneJobId] = useState<string | null>(
    null,
  );
  const [isEnablingStudioPush, setIsEnablingStudioPush] = useState(false);
  const [hasShownNoSessionsToast, setHasShownNoSessionsToast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (serverNowValue === undefined) return;
    setClockOffsetMs(serverNowValue - Date.now());
    const monotonicNow = getMonotonicNow();
    if (monotonicNow === null) {
      setClockAnchor(null);
      return;
    }
    setClockAnchor({
      serverNow: serverNowValue,
      monotonicNow,
    });
  }, [serverNowValue]);

  useEffect(() => {
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
  }, [clockAnchor, clockOffsetMs]);

  useEffect(() => {
    if (currentUser?.role !== "instructor" || !myApplications) {
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
  }, [clockOffsetMs, currentUser?.role, myApplications, serverNow]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 2600);
    return () => {
      clearTimeout(timer);
    };
  }, [statusMessage]);

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
  const jobsEmptyMinHeight = Math.max(
    260,
    Math.round(windowHeight - insets.top - insets.bottom - 140),
  );

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

  const applyDraftDateTime = (target: PickerTarget, nextDate: Date) => {
    setStudioDraft((current) => {
      const nextTimestamp = nextDate.getTime();
      if (target === "start") {
        const duration = Math.max(
          current.endTime - current.startTime,
          30 * MINUTE_MS,
        );
        const adjustedEnd =
          nextTimestamp >= current.endTime
            ? nextTimestamp + duration
            : current.endTime;
        return {
          ...current,
          startTime: nextTimestamp,
          endTime: adjustedEnd,
        };
      }

      const minimumEnd = current.startTime + 15 * MINUTE_MS;
      return {
        ...current,
        endTime: Math.max(nextTimestamp, minimumEnd),
      };
    });
  };

  const openNativeDateTimePicker = (target: PickerTarget) => {
    if (Platform.OS === "android") {
      if (!NativeDateTimePickerAndroid) {
        setErrorMessage(t("jobsTab.errors.datetimePickerUnavailable"));
        return;
      }

      const initial = new Date(
        target === "start" ? studioDraft.startTime : studioDraft.endTime,
      );

      NativeDateTimePickerAndroid.open({
        value: initial,
        mode: "date",
        is24Hour: true,
        timeZoneName: DEVICE_TIME_ZONE,
        onChange: (_dateEvent, selectedDate) => {
          if (!selectedDate) return;
          NativeDateTimePickerAndroid?.open({
            value: selectedDate,
            mode: "time",
            is24Hour: true,
            timeZoneName: DEVICE_TIME_ZONE,
            onChange: (_timeEvent, selectedTime) => {
              if (!selectedTime) return;
              const combined = new Date(selectedDate);
              combined.setHours(
                selectedTime.getHours(),
                selectedTime.getMinutes(),
                0,
                0,
              );
              applyDraftDateTime(target, combined);
            },
          });
        },
      });

      return;
    }

    if (!NativeDateTimePicker) {
      setErrorMessage(t("jobsTab.errors.datetimePickerUnavailable"));
      return;
    }

    setIosPickerTarget(target);
  };

  const postStudioJob = async () => {
    if (currentUser.role !== "studio") return;
    const referenceNow = serverNow?.now ?? now;

    if (!studioDraft.sport) {
      setErrorMessage(t("jobsTab.errors.sportRequired"));
      return;
    }

    const pay = Number.parseFloat(studioDraft.payInput);
    if (!Number.isFinite(pay) || pay <= 0) {
      setErrorMessage(t("jobsTab.errors.payRequired"));
      return;
    }

    if (studioDraft.startTime <= referenceNow) {
      setErrorMessage(t("jobsTab.errors.startMustBeFuture"));
      return;
    }

    if (studioDraft.endTime <= studioDraft.startTime) {
      setErrorMessage(t("jobsTab.errors.endMustBeAfterStart"));
      return;
    }

    const applicationDeadline =
      studioDraft.startTime - studioDraft.applicationLeadMinutes * MINUTE_MS;
    if (applicationDeadline <= referenceNow) {
      setErrorMessage(t("jobsTab.errors.applicationDeadlineMustBeFuture"));
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingStudio(true);

    try {
      const note = trimOptional(studioDraft.note);
      await postJob({
        sport: studioDraft.sport,
        startTime: studioDraft.startTime,
        endTime: studioDraft.endTime,
        timeZone: DEVICE_TIME_ZONE,
        pay,
        maxParticipants: studioDraft.maxParticipants,
        cancellationDeadlineHours: studioDraft.cancellationDeadlineHours,
        applicationDeadline,
        ...omitUndefined({ note }),
      });

      setStatusMessage(t("jobsTab.success.posted"));
      setStudioDraft((current) => ({
        ...current,
        note: "",
      }));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToPost");
      setErrorMessage(message);
    } finally {
      setIsSubmittingStudio(false);
    }
  };

  const applyForJob = async (jobId: Id<"jobs">) => {
    if (currentUser.role !== "instructor") return;

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
      setIsApplyingToJobId(null);
    }
  };

  const reviewStudioApplication = async (
    applicationId: Id<"jobApplications">,
    status: "accepted" | "rejected",
  ) => {
    if (currentUser.role !== "studio") return;

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
        sportLabel: toSportLabel(session.sport as never),
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {errorMessage ? (
          <View
            style={[
              styles.messageRow,
              { borderBottomColor: palette.border, backgroundColor: palette.surfaceAlt },
            ]}
          >
            <ThemedText selectable style={{ color: palette.danger }}>
              {errorMessage}
            </ThemedText>
          </View>
        ) : null}

        {currentUser.role === "studio" ? (
          <>
            {studioNotificationSettings !== undefined &&
            !studioNotificationSettings?.hasExpoPushToken ? (
              <View
                style={[styles.section, { borderBottomColor: palette.border }]}
              >
                <View style={styles.settingRow}>
                  <View style={styles.settingCopy}>
                    <ThemedText type="defaultSemiBold">
                      {t("jobsTab.studioPushTitle")}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("jobsTab.studioPushDescription")}
                    </ThemedText>
                  </View>
                  <BrandButton
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
              <ThemedText type="defaultSemiBold">
                {t("jobsTab.studioCreateTitle")}
              </ThemedText>

              <View style={styles.sectionBlock}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.form.sport")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {SPORT_TYPES.map((sport) => (
                    <OptionChip
                      key={sport}
                      label={toSportLabel(sport)}
                      selected={studioDraft.sport === sport}
                      onPress={() => {
                        setStudioDraft((current) => ({ ...current, sport }));
                      }}
                      borderColor={palette.border}
                      selectedBorderColor={palette.primary}
                      selectedBackgroundColor={palette.primarySubtle}
                      selectedTextColor={palette.primary}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.timeCardRow}>
                <Pressable
                  style={[styles.timeField, { borderColor: palette.border }]}
                  onPress={() => {
                    openNativeDateTimePicker("start");
                  }}
                >
                  <ThemedText type="defaultSemiBold">
                    {t("jobsTab.form.startTime")}
                  </ThemedText>
                  <ThemedText>{formatDateTime(studioDraft.startTime, locale)}</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.timeField, { borderColor: palette.border }]}
                  onPress={() => {
                    openNativeDateTimePicker("end");
                  }}
                >
                  <ThemedText type="defaultSemiBold">
                    {t("jobsTab.form.endTime")}
                  </ThemedText>
                  <ThemedText>{formatDateTime(studioDraft.endTime, locale)}</ThemedText>
                </Pressable>
              </View>

              {Platform.OS === "ios" && iosPickerTarget && NativeDateTimePicker ? (
                <View
                  style={[
                    styles.inlinePickerWrap,
                    { borderColor: palette.border, backgroundColor: palette.surfaceAlt },
                  ]}
                >
                  <ThemedText type="defaultSemiBold">
                    {iosPickerTarget === "start"
                      ? t("jobsTab.form.startTime")
                      : t("jobsTab.form.endTime")}
                  </ThemedText>
                  <NativeDateTimePicker
                    value={
                      new Date(
                        iosPickerTarget === "start"
                          ? studioDraft.startTime
                          : studioDraft.endTime,
                      )
                    }
                    mode="datetime"
                    display="spinner"
                    timeZoneName={DEVICE_TIME_ZONE}
                    onChange={(_event: unknown, selectedDate?: Date) => {
                      if (!selectedDate) return;
                      applyDraftDateTime(iosPickerTarget, selectedDate);
                    }}
                  />
                  <BrandButton
                    label={t("jobsTab.actions.done")}
                    variant="secondary"
                    onPress={() => {
                      setIosPickerTarget(null);
                    }}
                  />
                </View>
              ) : null}

              <View style={styles.sectionBlock}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.form.duration")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {DURATION_PRESETS.map((minutes) => {
                    const currentDuration = Math.round(
                      (studioDraft.endTime - studioDraft.startTime) / MINUTE_MS,
                    );
                    return (
                      <OptionChip
                        key={minutes}
                        label={t("jobsTab.form.minutes", { value: minutes })}
                        selected={currentDuration === minutes}
                        onPress={() => {
                          setStudioDraft((current) => ({
                            ...current,
                            endTime: current.startTime + minutes * MINUTE_MS,
                          }));
                        }}
                        borderColor={palette.border}
                        selectedBorderColor={palette.primary}
                        selectedBackgroundColor={palette.primarySubtle}
                        selectedTextColor={palette.primary}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.form.pay")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {PAY_PRESETS.map((pay) => (
                    <OptionChip
                      key={pay}
                      label={t("jobsTab.card.pay", { value: pay })}
                      selected={studioDraft.payInput === String(pay)}
                      onPress={() => {
                        setStudioDraft((current) => ({
                          ...current,
                          payInput: String(pay),
                        }));
                      }}
                      borderColor={palette.border}
                      selectedBorderColor={palette.primary}
                      selectedBackgroundColor={palette.primarySubtle}
                      selectedTextColor={palette.primary}
                    />
                  ))}
                </View>
                <TextInput
                  value={studioDraft.payInput}
                  onChangeText={(value) =>
                    setStudioDraft((current) => ({
                      ...current,
                      payInput: sanitizeDecimalInput(value),
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholder={t("jobsTab.form.customPayPlaceholder")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingCopy}>
                  <ThemedText type="defaultSemiBold">
                    {t("jobsTab.form.maxParticipants")}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {t("jobsTab.form.maxParticipantsHint")}
                  </ThemedText>
                </View>
                <View style={[styles.stepperWrap, { borderColor: palette.border }]}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => {
                      setStudioDraft((current) => ({
                        ...current,
                        maxParticipants: Math.max(
                          MAX_PARTICIPANTS_MIN,
                          current.maxParticipants - 1,
                        ),
                      }));
                    }}
                  >
                    <ThemedText type="subtitle">-</ThemedText>
                  </Pressable>
                  <ThemedText
                    type="defaultSemiBold"
                    selectable
                    style={styles.stepperValue}
                  >
                    {studioDraft.maxParticipants}
                  </ThemedText>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => {
                      setStudioDraft((current) => ({
                        ...current,
                        maxParticipants: Math.min(
                          MAX_PARTICIPANTS_MAX,
                          current.maxParticipants + 1,
                        ),
                      }));
                    }}
                  >
                    <ThemedText type="subtitle">+</ThemedText>
                  </Pressable>
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.form.cancellationDeadlineHours")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {CANCELLATION_PRESETS.map((hours) => (
                    <OptionChip
                      key={hours}
                      label={t("jobsTab.form.hours", { value: hours })}
                      selected={studioDraft.cancellationDeadlineHours === hours}
                      onPress={() => {
                        setStudioDraft((current) => ({
                          ...current,
                          cancellationDeadlineHours: hours,
                        }));
                      }}
                      borderColor={palette.border}
                      selectedBorderColor={palette.primary}
                      selectedBackgroundColor={palette.primarySubtle}
                      selectedTextColor={palette.primary}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.form.applicationLead")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {APPLICATION_LEAD_PRESETS.map((minutes) => (
                    <OptionChip
                      key={minutes}
                      label={t("jobsTab.form.minutes", { value: minutes })}
                      selected={studioDraft.applicationLeadMinutes === minutes}
                      onPress={() => {
                        setStudioDraft((current) => ({
                          ...current,
                          applicationLeadMinutes: minutes,
                        }));
                      }}
                      borderColor={palette.border}
                      selectedBorderColor={palette.primary}
                      selectedBackgroundColor={palette.primarySubtle}
                      selectedTextColor={palette.primary}
                    />
                  ))}
                </View>
              </View>

              <TextInput
                value={studioDraft.note}
                onChangeText={(value) =>
                  setStudioDraft((current) => ({ ...current, note: value }))
                }
                multiline
                placeholder={t("jobsTab.form.notesPlaceholder")}
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  styles.noteInput,
                  { borderColor: palette.border, color: palette.text },
                ]}
              />

              <BrandButton
                label={
                  isSubmittingStudio
                    ? t("jobsTab.actions.posting")
                    : t("jobsTab.actions.post")
                }
                onPress={() => {
                  void postStudioJob();
                }}
                disabled={isSubmittingStudio}
              />
            </View>

            <View style={[styles.section, { borderBottomColor: palette.border }]}>
              <ThemedText type="defaultSemiBold">{t("jobsTab.studioFeedTitle")}</ThemedText>
              {studioJobs === undefined ? (
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.loading")}
                </ThemedText>
              ) : studioJobs.length === 0 ? (
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.emptyStudio")}
                </ThemedText>
              ) : (
                studioJobs.map((job, index) => (
                  <View
                    key={job.jobId}
                    style={[
                      styles.feedRow,
                      {
                        borderTopColor: palette.border,
                        borderTopWidth: index === 0 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={styles.jobHeaderRow}>
                      <ThemedText type="defaultSemiBold">
                        {toSportLabel(job.sport as never)}
                      </ThemedText>
                      <ThemedText
                        style={{
                          color:
                            getJobStatusTone(job.status) === "primary"
                              ? palette.primary
                              : getJobStatusTone(job.status) === "success"
                                ? palette.success
                                : palette.textMuted,
                        }}
                      >
                        {t(JOB_STATUS_TRANSLATION_KEYS[job.status])}
                      </ThemedText>
                    </View>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {job.zone} • {formatDateTime(job.startTime, locale)}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("jobsTab.card.pay", { value: job.pay })}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("jobsTab.applicationsCount", {
                        total: job.applicationsCount,
                        pending: job.pendingApplicationsCount,
                      })}
                    </ThemedText>

                    <View style={styles.sectionBlock}>
                      <ThemedText type="defaultSemiBold">
                        {t("jobsTab.studioApplicationsTitle")}
                      </ThemedText>
                      {job.applications.length === 0 ? (
                        <ThemedText style={{ color: palette.textMuted }}>
                          {t("jobsTab.emptyStudioApplications")}
                        </ThemedText>
                      ) : (
                        job.applications.map((application) => (
                          <View
                            key={application.applicationId}
                            style={[
                              styles.applicationRow,
                              { borderTopColor: palette.border },
                            ]}
                          >
                            <View style={styles.jobHeaderRow}>
                              <ThemedText type="defaultSemiBold">
                                {application.instructorName}
                              </ThemedText>
                              <ThemedText style={{ color: palette.textMuted }}>
                                {t(getApplicationStatusTranslationKey(application.status))}
                              </ThemedText>
                            </View>
                            <ThemedText style={{ color: palette.textMuted }}>
                              {formatDateTime(application.appliedAt, locale)}
                            </ThemedText>
                            {application.message ? (
                              <ThemedText>{application.message}</ThemedText>
                            ) : null}
                            {application.status === "pending" &&
                            job.status === "open" ? (
                              <View style={styles.actionRow}>
                                <BrandButton
                                  style={styles.actionButton}
                                  label={
                                    isReviewingApplicationId ===
                                    application.applicationId
                                      ? t("jobsTab.actions.accepting")
                                      : t("jobsTab.actions.accept")
                                  }
                                  onPress={() => {
                                    void reviewStudioApplication(
                                      application.applicationId,
                                      "accepted",
                                    );
                                  }}
                                  disabled={
                                    isReviewingApplicationId ===
                                    application.applicationId
                                  }
                                />
                                <BrandButton
                                  style={styles.actionButton}
                                  label={
                                    isReviewingApplicationId ===
                                    application.applicationId
                                      ? t("jobsTab.actions.rejecting")
                                      : t("jobsTab.actions.reject")
                                  }
                                  variant="secondary"
                                  onPress={() => {
                                    void reviewStudioApplication(
                                      application.applicationId,
                                      "rejected",
                                    );
                                  }}
                                  disabled={
                                    isReviewingApplicationId ===
                                    application.applicationId
                                  }
                                />
                              </View>
                            ) : null}
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {currentUser.role === "instructor" ? (
          <>
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
            ) : null}

            {needsDoneSessions.length > 0 ? (
              <View style={[styles.section, { borderBottomColor: palette.border }]}>
                <ThemedText type="defaultSemiBold">
                  {t("jobsTab.needsDoneTitle", { count: needsDoneSessions.length })}
                </ThemedText>
                {needsDoneSessions.map((session, index) => (
                  <View
                    key={session.applicationId}
                    style={[
                      styles.archiveRow,
                      {
                        borderTopColor: palette.border,
                        borderTopWidth: index === 0 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={styles.archiveCopy}>
                      <ThemedText type="defaultSemiBold">
                        {toSportLabel(session.sport as never)}
                      </ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {session.studioName}
                      </ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {formatDateTime(session.endTime, locale)}
                      </ThemedText>
                    </View>
                    <BrandButton
                      label={
                        isMarkingDoneJobId === String(session.jobId)
                          ? t("jobsTab.actions.markingLessonDone")
                          : t("jobsTab.actions.markLessonDone")
                      }
                      variant="secondary"
                      onPress={() => {
                        void markLessonDone(session.jobId);
                      }}
                      disabled={isMarkingDoneJobId === String(session.jobId)}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            <View style={[styles.jobsFeed, { borderBottomColor: palette.border }]}>
              {availableJobs === undefined ? (
                <View style={[styles.emptyStateWrap, { minHeight: jobsEmptyMinHeight }]}>
                  <ThemedText style={[styles.emptyStateText, { color: palette.textMuted }]}>
                    {t("jobsTab.loading")}
                  </ThemedText>
                </View>
              ) : availableJobs.length === 0 ? (
                <View style={[styles.emptyStateWrap, { minHeight: jobsEmptyMinHeight }]}>
                  <MaterialIcons
                    name="work-off"
                    size={34}
                    color={palette.textMuted}
                  />
                  <ThemedText style={[styles.emptyStateText, { color: palette.textMuted }]}>
                    {t("jobsTab.emptyInstructor")}
                  </ThemedText>
                </View>
              ) : (
                availableJobs.map((job, index) => (
                  <View
                    key={job.jobId}
                    style={[
                      styles.jobRow,
                      {
                        borderTopColor: palette.border,
                        borderTopWidth: index === 0 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={styles.jobHeaderRow}>
                      <View style={styles.jobPrimaryCopy}>
                        <ThemedText type="subtitle">
                          {toSportLabel(job.sport as never)}
                        </ThemedText>
                        <ThemedText style={{ color: palette.textMuted }}>
                          {job.studioName}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {job.applicationStatus
                          ? t(getApplicationStatusTranslationKey(job.applicationStatus))
                          : t("jobsTab.status.job.open")}
                      </ThemedText>
                    </View>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {formatDateTime(job.startTime, locale)} • {job.zone}
                    </ThemedText>
                    <ThemedText>{job.note ?? t("jobsTab.noNotes")}</ThemedText>
                    <View style={styles.jobFooterRow}>
                      <ThemedText type="defaultSemiBold">
                        {t("jobsTab.card.pay", { value: job.pay })}
                      </ThemedText>
                      <Pressable
                        style={[
                          styles.rowActionButton,
                          {
                            borderColor: job.applicationStatus
                              ? palette.borderStrong
                              : palette.primary,
                            backgroundColor: job.applicationStatus
                              ? palette.surface
                              : palette.primarySubtle,
                          },
                        ]}
                        disabled={
                          Boolean(job.applicationStatus) ||
                          isApplyingToJobId === job.jobId
                        }
                        onPress={() => {
                          void applyForJob(job.jobId);
                        }}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={{
                            color: job.applicationStatus
                              ? palette.textMuted
                              : palette.primary,
                          }}
                        >
                          {isApplyingToJobId === job.jobId
                            ? t("jobsTab.actions.applying")
                            : t("jobsTab.actions.apply")}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {nonAcceptedApplications.length > 0 ? (
              <View style={[styles.section, { borderBottomColor: palette.border }]}>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("jobsTab.applicationSummary", {
                    count: nonAcceptedApplications.length,
                  })}
                </ThemedText>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {statusMessage ? (
        <View
          pointerEvents="none"
          style={[styles.toastWrap, { top: insets.top + 10 }]}
        >
          <View
            style={[
              styles.toastBlob,
              {
                borderColor: palette.borderStrong,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <MaterialIcons name="check-circle" size={16} color={palette.success} />
            <ThemedText style={{ color: palette.text }}>{statusMessage}</ThemedText>
          </View>
        </View>
      ) : null}

      {currentUser.role === "instructor" ? (
        <Pressable
          style={[
            styles.archiveFab,
            {
              bottom: insets.bottom + 12,
              right: 16,
              backgroundColor:
                archivedSessions.length > 0 ? palette.primarySubtle : palette.surface,
              borderColor:
                archivedSessions.length > 0 ? palette.primary : palette.borderStrong,
            },
          ]}
          onPress={() => {
            if (archivedSessions.length === 0) return;
            setIsArchiveOpen((current) => !current);
          }}
        >
          <MaterialIcons
            name="archive"
            size={24}
            color={archivedSessions.length > 0 ? palette.primary : palette.textMuted}
          />
          {archivedSessions.length > 0 ? (
            <View style={[styles.archiveBadge, { backgroundColor: palette.primary }]}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: palette.onPrimary, fontSize: 11 }}
              >
                {archivedSessions.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {currentUser.role === "instructor" && isArchiveOpen ? (
        <View style={styles.archiveOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setIsArchiveOpen(false);
            }}
          />
          <View
            style={[
              styles.archiveSheet,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                paddingBottom: insets.bottom + 10,
              },
            ]}
          >
            <View style={styles.archiveHeader}>
              <ThemedText type="defaultSemiBold">{t("jobsTab.archiveTitle")}</ThemedText>
              <Pressable
                onPress={() => {
                  setIsArchiveOpen(false);
                }}
              >
                <MaterialIcons name="close" size={18} color={palette.textMuted} />
              </Pressable>
            </View>

            {archivedSessions.length === 0 ? (
              <ThemedText style={{ color: palette.textMuted }}>
                {t("jobsTab.emptyArchive")}
              </ThemedText>
            ) : (
              <ScrollView
                style={styles.archiveList}
                contentContainerStyle={styles.archiveListContent}
                contentInsetAdjustmentBehavior="automatic"
              >
                {archivedSessions.map((session, index) => (
                  <View
                    key={session.applicationId}
                    style={[
                      styles.archiveRow,
                      {
                        borderTopColor: palette.border,
                        borderTopWidth: index === 0 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={styles.archiveCopy}>
                      <ThemedText type="defaultSemiBold">
                        {toSportLabel(session.sport as never)}
                      </ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {session.studioName}
                      </ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {formatCompactDateTime(session.startTime, locale)}
                      </ThemedText>
                    </View>
                    <ThemedText type="defaultSemiBold">
                      {t("jobsTab.card.pay", { value: session.pay })}
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
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
  messageRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 5,
  },
  toastBlob: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
  },
  archiveFab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  archiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    justifyContent: "flex-end",
  },
  archiveSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    maxHeight: "62%",
  },
  archiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  archiveList: {
    flexGrow: 0,
  },
  archiveListContent: {
    paddingBottom: 8,
  },
});
