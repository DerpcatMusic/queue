import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { StudioJobsList } from "@/components/jobs/studio/studio-jobs-list";
import { ThemedText } from "@/components/themed-text";
import { KitButton } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/empty-state";
import { BrandSpacing } from "@/constants/brand";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useBrand } from "@/hooks/use-brand";
import {
  formatDateTime,
  createDefaultStudioDraft,
  trimOptional,
  sanitizeDecimalInput,
  MINUTE_MS,
  DEVICE_TIME_ZONE,
  PickerTarget,
  StudioDraft,
  DURATION_PRESETS,
  PAY_PRESETS,
  MAX_PARTICIPANTS_MIN,
  MAX_PARTICIPANTS_MAX,
  CANCELLATION_PRESETS,
  APPLICATION_LEAD_PRESETS,
} from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

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


type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  borderColor: string | import('react-native').ColorValue;
  selectedBorderColor: string | import('react-native').ColorValue;
  selectedBackgroundColor: string | import('react-native').ColorValue;
  selectedTextColor: string | import('react-native').ColorValue;
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

type StudioFormStepSectionProps = {
  stepLabel: string;
  title: string;
  subtitle?: string;
  palette: ReturnType<typeof useBrand>;
  delay: number;
  children: ReactNode;
};

function StudioFormStepSection({
  stepLabel,
  title,
  subtitle,
  palette,
  delay,
  children,
}: StudioFormStepSectionProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(320).springify()}
      style={[
        styles.formStepSection,
        {
          borderColor: palette.border,
          backgroundColor: palette.surfaceAlt,
        },
      ]}
    >
      <View style={styles.formStepHeader}>
        <View
          style={[
            styles.formStepBadge,
            {
              borderColor: palette.primary,
              backgroundColor: palette.primarySubtle,
            },
          ]}
        >
          <ThemedText type="micro" style={{ color: palette.primary }}>
            {stepLabel}
          </ThemedText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </Animated.View>
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

  const studioJobs = useQuery(
    api.jobs.getMyStudioJobsWithApplications,
    currentUser?.role === "studio" ? { limit: 80 } : "skip",
  );

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
  const [isEnablingStudioPush, setIsEnablingStudioPush] = useState(false);
  const [isReviewingApplicationId, setIsReviewingApplicationId] = useState<Id<"jobApplications"> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const studioJobsStartedAtRef = useRef<number | null>(null);
  const studioOpenCount = studioJobs?.filter((job) => job.status === "open").length ?? 0;
  const studioPendingApplications =
    studioJobs?.reduce((sum, job) => sum + job.pendingApplicationsCount, 0) ?? 0;
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  const applyDraftDateTime = (target: PickerTarget, nextDate: Date) => {
    setStudioDraft((current: StudioDraft) => {
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
    const stopTimer = FEATURE_FLAGS.jobsPerfTelemetry
      ? createPerfTimer("jobs.studio.post_job_mutation")
      : null;
    const referenceNow = Date.now();

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
      setStudioDraft((current: StudioDraft) => ({
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



  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View style={{ paddingHorizontal: BrandSpacing.lg, paddingTop: 8 }}>
            <FeedHero
              title={t("jobsTab.title")}
              subtitle={t("jobsTab.studioSubtitle")}
              palette={palette}
              metrics={[
                {
                  label: t("jobsTab.studioFeedTitle"),
                  value: studioJobs?.length ?? 0,
                },
                {
                  label: t("jobsTab.status.job.open"),
                  value: studioOpenCount,
                },
                {
                  label: t("jobsTab.studioApplicationsTitle"),
                  value: studioPendingApplications,
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

              <StudioFormStepSection
                stepLabel="01"
                title={`${t("jobsTab.form.sport")} + ${t("jobsTab.form.startTime")}`}
                subtitle={t("jobsTab.timezoneHint", { timeZone: deviceTimeZone })}
                palette={palette}
                delay={40}
              >
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
                          setStudioDraft((current: StudioDraft) => ({ ...current, sport }));
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
                      { borderColor: palette.border, backgroundColor: palette.surface },
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
                    <KitButton
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
                    {DURATION_PRESETS.map((minutes: number) => {
                      const currentDuration = Math.round(
                        (studioDraft.endTime - studioDraft.startTime) / MINUTE_MS,
                      );
                      return (
                        <OptionChip
                          key={minutes}
                          label={t("jobsTab.form.minutes", { value: minutes })}
                          selected={currentDuration === minutes}
                          onPress={() => {
                            setStudioDraft((current: StudioDraft) => ({
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
              </StudioFormStepSection>

              <StudioFormStepSection
                stepLabel="02"
                title={`${t("jobsTab.form.pay")} + ${t("jobsTab.form.maxParticipants")}`}
                subtitle={t("jobsTab.form.maxParticipantsHint")}
                palette={palette}
                delay={90}
              >
                <View style={styles.sectionBlock}>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {t("jobsTab.form.pay")}
                  </ThemedText>
                  <View style={styles.chipGrid}>
                    {PAY_PRESETS.map((pay: number) => (
                      <OptionChip
                        key={pay}
                        label={t("jobsTab.card.pay", { value: pay })}
                        selected={studioDraft.payInput === String(pay)}
                        onPress={() => {
                          setStudioDraft((current: StudioDraft) => ({
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
                      { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
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
                  <View style={[styles.stepperWrap, { borderColor: palette.borderStrong, backgroundColor: palette.surface }]}>
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
              </StudioFormStepSection>

              <StudioFormStepSection
                stepLabel="03"
                title={`${t("jobsTab.form.cancellationDeadlineHours")} + ${t("jobsTab.form.applicationLead")}`}
                subtitle={t("jobsTab.form.notesPlaceholder")}
                palette={palette}
                delay={130}
              >
                <View style={styles.sectionBlock}>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {t("jobsTab.form.cancellationDeadlineHours")}
                  </ThemedText>
                  <View style={styles.chipGrid}>
                    {CANCELLATION_PRESETS.map((hours: number) => (
                      <OptionChip
                        key={hours}
                        label={t("jobsTab.form.hours", { value: hours })}
                        selected={studioDraft.cancellationDeadlineHours === hours}
                        onPress={() => {
                          setStudioDraft((current: StudioDraft) => ({
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
                    {APPLICATION_LEAD_PRESETS.map((minutes: number) => (
                      <OptionChip
                        key={minutes}
                        label={t("jobsTab.form.minutes", { value: minutes })}
                        selected={studioDraft.applicationLeadMinutes === minutes}
                        onPress={() => {
                          setStudioDraft((current: StudioDraft) => ({
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
                    { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
                  ]}
                />

                <KitButton
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
              </StudioFormStepSection>
            </View>

            <View style={{ flex: 1, paddingTop: BrandSpacing.md }}>
              <FeedSectionHeader
                title={t("jobsTab.studioFeedTitle")}
                subtitle={t("jobsTab.studioApplicationsTitle")}
                palette={palette}
              />
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
              ) : (
                <StudioJobsList
                  jobs={studioJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  reviewingApplicationId={isReviewingApplicationId}
                  onReview={(applicationId, status) => {
                    void reviewStudioApplication(applicationId, status);
                  }}
                  t={t}
                />
              )}
            </View>
          </>
        ) : null}

      </ScrollView>
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
});






