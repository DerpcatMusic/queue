import type BottomSheet from "@gorhom/bottom-sheet";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ensureStripeNativeSdkInitialized,
  presentStripeNativeBankPayment,
  presentStripeNativePaymentSheet,
  presentStripeNativePlatformPayPayment,
} from "@/features/payments/lib/stripe-native";
import { DEVICE_TIME_ZONE, MINUTE_MS, type StudioDraft, trimOptional } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import { openStudioComplianceGate } from "@/lib/open-studio-compliance-gate";
import { createPerfTimer, logPerfSummary, recordPerfMetric } from "@/lib/perf-telemetry";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { STRIPE_MERCHANT_DISPLAY_NAME } from "@/lib/stripe";
import {
  buildLatestPaymentByJobId,
  filterStudioJobsByTime,
  getStudioPushErrorMessage,
  type StudioControllerJob,
} from "./use-studio-feed-controller.helpers";

export type StudioJobsTimeFilter = "all" | "active" | "past";

const STUDIO_COMPLIANCE_ROUTE = "/studio/profile/compliance" as const;

type UseStudioFeedControllerArgs = {
  t: TFunction;
};

type StripeCheckoutDetails = {
  checkout: {
    clientSecret: string;
    providerCountry: string;
    currency: string;
    amountAgorot: number;
  };
  paymentSheetInput: {
    clientSecret: string;
    billingEmail?: string;
    customerId?: string;
    merchantCountryCode?: string;
    currencyCode?: string;
  };
  billingName: string;
};

function getStudioComplianceBlockersLabel(reasons: string[], t: TFunction) {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "owner_identity_required":
          return t("profile.studioCompliance.blockers.identity");
        case "business_profile_required":
          return t("profile.studioCompliance.blockers.billing");
        case "payment_method_required":
          return t("profile.studioCompliance.blockers.payment");
        default:
          return reason;
      }
    })
    .join(" · ");
}

function parseStudioComplianceReasons(message: string): string[] | null {
  const prefix = "Studio compliance required:";
  if (!message.startsWith(prefix)) {
    return null;
  }

  const reasons = message
    .slice(prefix.length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return reasons.length > 0 ? reasons : null;
}

export function useStudioFeedController({ t }: UseStudioFeedControllerArgs) {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);

  const postJob = useMutation(api.jobs.postJob.postJob);
  const reviewApplication = useMutation(api.jobs.review.reviewApplication);
  const updateStudioNotificationSettings = useMutation(
    api.studios.settings.updateMyStudioNotificationSettings,
  );
  const createStudioPaymentOfferV2 = useMutation(api.payments.core.createStudioPaymentOfferV2);
  const createStudioPaymentOrderV2 = useMutation(api.payments.core.createStudioPaymentOrderV2);
  const createStripePaymentSheetForPaymentOrderV2 = useAction(
    api.payments.actions.createStripePaymentSheetForPaymentOrderV2,
  );

  const studioJobs = useQuery(
    api.jobs.studioManagement.getMyStudioJobsWithApplications,
    currentUser?.role === "studio" ? { limit: 80 } : "skip",
  );

  const studioNotificationSettings = useQuery(
    api.studios.settings.getMyStudioNotificationSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );
  const studioPayments = useQuery(
    api.payments.core.listMyPaymentsV2,
    currentUser?.role === "studio" ? { limit: 200 } : "skip",
  );
  const studioBranches = useQuery(
    api.studios.branches.getMyStudioBranches,
    currentUser?.role === "studio" ? {} : "skip",
  );
  const studioComplianceSummary = useQuery(
    api.compliance.studio.getMyStudioComplianceSummary,
    currentUser?.role === "studio" ? {} : "skip",
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
    const resolvedBranchId =
      draft.branchId ??
      (studioBranches?.length === 1 ? (studioBranches[0]?.branchId ?? null) : null);

    if (!resolvedBranchId) {
      setErrorMessage(t("jobsTab.errors.branchRequired"));
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

    if (studioComplianceSummary === undefined) {
      setErrorMessage(t("jobsTab.studioComplianceGate.loading"));
      return;
    }

    if (!studioComplianceSummary.canPublishJobs) {
      setErrorMessage(null);
      setStatusMessage(null);
      openStudioComplianceGate(t, {
        blockers:
          studioComplianceSummary.blockingReasons.length > 0
            ? getStudioComplianceBlockersLabel(studioComplianceSummary.blockingReasons, t)
            : t("jobsTab.studioComplianceGate.genericBlockers"),
        onOpenCompliance: () => {
          router.push(STUDIO_COMPLIANCE_ROUTE as Href);
        },
      });
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingStudio(true);

    try {
      const note = trimOptional(draft.note);
      await postJob({
        branchId: resolvedBranchId,
        sport: draft.sport,
        requiredCapabilityTags: draft.requiredCapabilityTags,
        preferredCapabilityTags: draft.preferredCapabilityTags,
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
          boostCustomAmount: draft.boostCustomAmount,
          boostTriggerMinutes: draft.boostTriggerMinutes,
        }),
      });

      setStatusMessage(t("jobsTab.success.posted"));
      createJobSheetRef.current?.close();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : t("jobsTab.errors.failedToPost");
      const complianceReasons = parseStudioComplianceReasons(message);
      if (complianceReasons) {
        setErrorMessage(null);
        setStatusMessage(null);
        openStudioComplianceGate(t, {
          blockers: getStudioComplianceBlockersLabel(
            studioComplianceSummary?.blockingReasons ?? complianceReasons,
            t,
          ),
          onOpenCompliance: () => {
            router.push(STUDIO_COMPLIANCE_ROUTE as Href);
          },
        });
        return;
      }
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
      if (isPushRegistrationError(error) && error.code === "permission_denied") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: t("jobsTab.errors.pushPermissionRequired"),
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
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

  const buildStripeCheckoutDetails = async (
    jobId: Id<"jobs">,
  ): Promise<StripeCheckoutDetails | undefined> => {
    if (currentUser?.role !== "studio") return;
    if (Platform.OS === "web") {
      setErrorMessage("Stripe native checkout is not available on web yet.");
      return;
    }

    await ensureStripeNativeSdkInitialized();
    const offer = await createStudioPaymentOfferV2({ jobId });
    const order = await createStudioPaymentOrderV2({ offerId: offer._id });
    const checkout = await createStripePaymentSheetForPaymentOrderV2({
      paymentOrderId: order._id,
    });
    const billingName =
      currentUser.fullName?.trim() ?? currentUser.name?.trim() ?? currentUser.email?.trim() ?? "";
    const paymentSheetInput = {
      clientSecret: checkout.clientSecret,
      merchantCountryCode: checkout.providerCountry,
      currencyCode: checkout.currency,
      ...(checkout.customerId ? { customerId: checkout.customerId } : {}),
      ...(currentUser.email ? { billingEmail: currentUser.email.trim() } : {}),
    };

    return { checkout, billingName, paymentSheetInput };
  };

  const startStudioCheckout = async (jobId: Id<"jobs">) => {
    setIsStartingCheckoutForJobId(jobId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const paymentDetails = await buildStripeCheckoutDetails(jobId);
      if (!paymentDetails) return;
      const { checkout, paymentSheetInput, billingName } = paymentDetails;
      await startStripeCheckoutWithFallback(checkout, paymentSheetInput, billingName);
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

  const startStudioNativeWalletCheckout = async (jobId: Id<"jobs">) => {
    setIsStartingCheckoutForJobId(jobId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const paymentDetails = await buildStripeCheckoutDetails(jobId);
      if (!paymentDetails) return;
      const { checkout, billingName } = paymentDetails;
      await startStripeWalletCheckout(checkout, billingName);
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

  const startStripeCheckoutWithFallback = async (
    checkout: StripeCheckoutDetails["checkout"],
    paymentSheetInput: StripeCheckoutDetails["paymentSheetInput"],
    billingName: string,
  ) => {
    const shouldPreferBankPayment =
      checkout.currency === "USD" && billingName.length > 0 && Platform.OS !== "web";

    const result = shouldPreferBankPayment
      ? await presentStripeNativeBankPayment({
          clientSecret: checkout.clientSecret,
          billingName,
          ...(paymentSheetInput.billingEmail
            ? { billingEmail: paymentSheetInput.billingEmail }
            : {}),
        })
      : await presentStripeNativePaymentSheet(paymentSheetInput);

    if (result.status === "failed" && shouldPreferBankPayment) {
      const fallbackResult = await presentStripeNativePaymentSheet(paymentSheetInput);
      if (fallbackResult.status === "success") {
        setStatusMessage(t("jobsTab.checkout.completed"));
        return;
      }
      if (fallbackResult.status === "canceled") {
        setStatusMessage(t("jobsTab.checkout.cancelled"));
        return;
      }
      throw new Error(fallbackResult.error);
    }

    if (result.status === "success") {
      setStatusMessage(t("jobsTab.checkout.completed"));
      return;
    }
    if (result.status === "canceled") {
      setStatusMessage(t("jobsTab.checkout.cancelled"));
      return;
    }
    throw new Error(result.error);
  };

  const startStripeWalletCheckout = async (
    checkout: StripeCheckoutDetails["checkout"],
    billingName: string,
  ) => {
    const result = await presentStripeNativePlatformPayPayment({
      clientSecret: checkout.clientSecret,
      merchantCountryCode: checkout.providerCountry,
      currencyCode: checkout.currency,
      amountAgorot: checkout.amountAgorot,
      merchantName: STRIPE_MERCHANT_DISPLAY_NAME,
      label: billingName || STRIPE_MERCHANT_DISPLAY_NAME,
    });

    if (result.status === "success") {
      setStatusMessage(t("jobsTab.checkout.completed"));
      return;
    }
    if (result.status === "canceled") {
      setStatusMessage(t("jobsTab.checkout.cancelled"));
      return;
    }
    throw new Error(result.error);
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
    buildStripeCheckoutDetails,
    startStudioCheckout,
    statusMessage,
    studioJobs,
    studioComplianceSummary,
    studioNotificationSettings,
    studioBranches,
    startStudioNativeWalletCheckout,
    toggleStudioPush,
  };
}
