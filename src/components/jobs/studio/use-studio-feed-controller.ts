import type BottomSheet from "@gorhom/bottom-sheet";
import { useAction, useMutation, useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { DEVICE_TIME_ZONE, MINUTE_MS, type StudioDraft, trimOptional } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { buildRapydBridgeUrl, resolveRapydAppReturnUrl } from "@/lib/rapyd-hosted-flow";

WebBrowser.maybeCompleteAuthSession();

export type StudioJobsStatusFilter = "all" | "needs_review" | "open" | "filled" | "completed";

type UseStudioFeedControllerArgs = {
  t: TFunction;
};

export function useStudioFeedController({ t }: UseStudioFeedControllerArgs) {
  const currentUser = useQuery(api.users.getCurrentUser);

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
  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsStatusFilter, setJobsStatusFilter] = useState<StudioJobsStatusFilter>("all");
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
      const applicants = job.applications
        .map((application) => application.instructorName)
        .join(" ");
      const haystack =
        `${job.zone} ${toSportLabel(job.sport as never)} ${applicants}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [studioJobs, jobsSearchQuery, jobsStatusFilter]);

  const latestPaymentByJobId = useMemo(() => {
    const map = new Map<
      string,
      {
        paymentId: Id<"payments">;
        status:
          | "created"
          | "pending"
          | "authorized"
          | "captured"
          | "failed"
          | "cancelled"
          | "refunded";
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
        ...omitUndefined({ note }),
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

  const enableStudioPush = async () => {
    if (currentUser?.role !== "studio") return;

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
          setStatusMessage(
            t("jobsTab.checkout.cancelled", { defaultValue: "Checkout cancelled." }),
          );
          return;
        }
      }

      const checkoutStatus = await retrieveCheckoutForPayment({
        paymentId: checkout.paymentId,
      });

      if (checkoutStatus.paymentStatus === "captured") {
        setStatusMessage(t("jobsTab.checkout.completed", { defaultValue: "Payment completed." }));
        return;
      }
      if (
        checkoutStatus.paymentStatus === "pending" ||
        checkoutStatus.paymentStatus === "authorized" ||
        checkoutStatus.paymentStatus === "created"
      ) {
        setStatusMessage(
          t("jobsTab.checkout.pendingConfirmation", {
            defaultValue: "Payment submitted. Waiting for provider confirmation.",
          }),
        );
        return;
      }
      if (checkoutStatus.paymentStatus === "cancelled") {
        setStatusMessage(t("jobsTab.checkout.cancelled", { defaultValue: "Checkout cancelled." }));
        return;
      }

      setErrorMessage(t("jobsTab.checkout.failed", { defaultValue: "Payment did not complete." }));
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
  };
}
