import type BottomSheet from "@gorhom/bottom-sheet";
import { useAction, useMutation, useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useRapydReturn } from "@/contexts/rapyd-return-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DEVICE_TIME_ZONE, MINUTE_MS, type StudioDraft, trimOptional } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { buildRapydBridgeUrl, resolveRapydAppReturnUrl } from "@/lib/rapyd-hosted-flow";
import {
  buildLatestPaymentByJobId,
  filterStudioJobsByTime,
  getStudioPushErrorMessage,
  type StudioControllerJob,
} from "./use-studio-feed-controller.helpers";

export type StudioJobsTimeFilter = "all" | "active" | "past";

type UseStudioFeedControllerArgs = {
  t: TFunction;
};

export function useStudioFeedController({ t }: UseStudioFeedControllerArgs) {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const currentUser = useQuery(api.users.getCurrentUser);
  const { consumeReturn: consumeCheckoutReturn, latestReturn: latestCheckoutReturn } =
    useRapydReturn("checkout");

  const postJob = useMutation(api.jobs.postJob);
  const reviewApplication = useMutation(api.jobs.reviewApplication);
  const updateStudioNotificationSettings = useMutation(
    api.users.updateMyStudioNotificationSettings,
  );
  const createCheckoutForJob = useAction(api.rapyd.createCheckoutForJob);
  const retrieveCheckoutForPayment = useAction(api.rapyd.retrieveCheckoutForPayment);

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
  const [isReviewingApplicationId, setIsReviewingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const [isStartingCheckoutForJobId, setIsStartingCheckoutForJobId] = useState<Id<"jobs"> | null>(
    null,
  );
  const [jobsTimeFilter, setJobsTimeFilter] = useState<StudioJobsTimeFilter>("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const studioJobsStartedAtRef = useRef<number | null>(null);
  const lastHandledCheckoutReturnRef = useRef<string | null>(null);

  const filteredStudioJobs = useMemo(() => {
    return filterStudioJobsByTime(studioJobs, jobsTimeFilter, Date.now());
  }, [studioJobs, jobsTimeFilter]);

  const latestPaymentByJobId = useMemo(
    () => buildLatestPaymentByJobId(studioPayments),
    [studioPayments],
  );

  const filteredStudioJobsWithPayments = useMemo(
    () =>
      filteredStudioJobs.map((job: StudioControllerJob) => ({
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

  const applyCheckoutOutcome = useMemo(
    () =>
      (
        paymentStatus:
          | "created"
          | "pending"
          | "authorized"
          | "captured"
          | "failed"
          | "cancelled"
          | "refunded",
      ) => {
        if (paymentStatus === "captured") {
          setStatusMessage(t("jobsTab.checkout.completed"));
          return;
        }
        if (
          paymentStatus === "pending" ||
          paymentStatus === "authorized" ||
          paymentStatus === "created"
        ) {
          setStatusMessage(t("jobsTab.checkout.pendingConfirmation"));
          return;
        }
        if (paymentStatus === "cancelled") {
          setStatusMessage(t("jobsTab.checkout.cancelled"));
          return;
        }

        setErrorMessage(t("jobsTab.checkout.failed"));
      },
    [t],
  );

  useEffect(() => {
    if (currentUser?.role !== "studio" || !latestCheckoutReturn) {
      return;
    }

    if (latestCheckoutReturn.result === "cancel") {
      consumeCheckoutReturn();
      setErrorMessage(null);
      setStatusMessage(t("jobsTab.checkout.cancelled"));
      return;
    }

    const jobId = latestCheckoutReturn.jobId;
    if (!jobId) {
      consumeCheckoutReturn();
      setErrorMessage(null);
      setStatusMessage(t("jobsTab.checkout.pendingConfirmation"));
      return;
    }

    const latestPayment = latestPaymentByJobId.get(jobId);
    if (!latestPayment) {
      return;
    }

    const handledKey = `${latestCheckoutReturn.url}:${latestPayment.paymentId}`;
    if (lastHandledCheckoutReturnRef.current === handledKey) {
      return;
    }
    lastHandledCheckoutReturnRef.current = handledKey;

    setErrorMessage(null);
    void (async () => {
      try {
        const checkoutStatus = await retrieveCheckoutForPayment({
          paymentId: latestPayment.paymentId,
        });
        applyCheckoutOutcome(checkoutStatus.paymentStatus);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("jobsTab.errors.failedToStartCheckout");
        setErrorMessage(message);
      } finally {
        consumeCheckoutReturn();
        lastHandledCheckoutReturnRef.current = null;
      }
    })();
  }, [
    applyCheckoutOutcome,
    consumeCheckoutReturn,
    currentUser?.role,
    latestCheckoutReturn,
    latestPaymentByJobId,
    retrieveCheckoutForPayment,
    t,
  ]);

  const postStudioJob = async (draft: StudioDraft) => {
    if (currentUser?.role !== "studio") return;
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

    const applicationDeadline = draft.startTime - draft.applicationLeadMinutes * MINUTE_MS;

    // Safety check for absolute minimum lead time (15 mins) if not specified
    const finalApplicationDeadline = Math.min(
      applicationDeadline,
      draft.startTime - 15 * MINUTE_MS,
    );

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
        ...omitUndefined({
          note,
          expiryOverrideMinutes: draft.expiryOverrideMinutes,
          boostPreset: draft.boostPreset,
        }),
      });

      setStatusMessage(t("jobsTab.success.posted"));
      createJobSheetRef.current?.close();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : t("jobsTab.errors.failedToPost");
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
    if (currentUser?.role !== "studio") return;
    const stopTimer = FEATURE_FLAGS.jobsPerfTelemetry
      ? createPerfTimer("jobs.studio.review_application_mutation")
      : null;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsReviewingApplicationId(applicationId);

    try {
      await reviewApplication({ applicationId, status });
      setStatusMessage(
        status === "accepted" ? t("jobsTab.success.accepted") : t("jobsTab.success.rejected"),
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

  const enableStudioPush = useCallback(async () => {
    if (currentUser?.role !== "studio") return;

    setIsEnablingStudioPush(true);
    setErrorMessage(null);

    try {
      const token = await registerForPushNotificationsAsync();
      await updateStudioNotificationSettings({
        notificationsEnabled: true,
        expoPushToken: token,
      });
      setStatusMessage(t("jobsTab.success.pushEnabled"));
    } catch (error) {
      setErrorMessage(getStudioPushErrorMessage(error, t));
    } finally {
      setIsEnablingStudioPush(false);
    }
  }, [currentUser?.role, t, updateStudioNotificationSettings]);

  const toggleStudioPush = useCallback(async () => {
    if (currentUser?.role !== "studio") return;

    if (
      !studioNotificationSettings?.hasExpoPushToken ||
      !studioNotificationSettings.notificationsEnabled
    ) {
      await enableStudioPush();
      return;
    }

    setIsEnablingStudioPush(true);
    setErrorMessage(null);

    try {
      await updateStudioNotificationSettings({
        notificationsEnabled: false,
      });
      setStatusMessage(t("jobsTab.success.pushDisabled"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("jobsTab.errors.failedToEnablePush");
      setErrorMessage(message);
    } finally {
      setIsEnablingStudioPush(false);
    }
  }, [
    currentUser?.role,
    enableStudioPush,
    studioNotificationSettings?.hasExpoPushToken,
    studioNotificationSettings?.notificationsEnabled,
    t,
    updateStudioNotificationSettings,
  ]);

  const startStudioCheckout = async (jobId: Id<"jobs">) => {
    if (currentUser?.role !== "studio") return;

    setIsStartingCheckoutForJobId(jobId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const appReturnUrl = resolveRapydAppReturnUrl("checkout");
      const completeCheckoutUrl = buildRapydBridgeUrl({
        bridgePath: "/rapyd/checkout-return-bridge",
        result: "complete",
        appReturnUrl,
        query: {
          jobId: String(jobId),
        },
      });
      const cancelCheckoutUrl = buildRapydBridgeUrl({
        bridgePath: "/rapyd/checkout-return-bridge",
        result: "cancel",
        appReturnUrl,
        query: {
          jobId: String(jobId),
        },
      });
      const checkout = await createCheckoutForJob({
        jobId,
        completeCheckoutUrl,
        cancelCheckoutUrl,
      });
      const authResult = await WebBrowser.openAuthSessionAsync(checkout.checkoutUrl, appReturnUrl);

      if (authResult.type === "success" && authResult.url) {
        const resultUrl = new URL(authResult.url);
        if ((resultUrl.searchParams.get("result") ?? "complete") === "cancel") {
          setStatusMessage(t("jobsTab.checkout.cancelled"));
          return;
        }
      }

      const checkoutStatus = await retrieveCheckoutForPayment({
        paymentId: checkout.paymentId,
      });

      applyCheckoutOutcome(checkoutStatus.paymentStatus);
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

  return {
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
    jobsTimeFilter,
    postStudioJob,
    reviewStudioApplication,
    setErrorMessage,
    setJobsTimeFilter,
    setStatusMessage,
    startStudioCheckout,
    statusMessage,
    studioJobs,
    studioNotificationSettings,
    toggleStudioPush,
  };
}
