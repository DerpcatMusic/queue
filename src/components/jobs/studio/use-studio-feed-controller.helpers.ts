import type { TFunction } from "i18next";

import type { Id } from "@/convex/_generated/dataModel";
import type { BoostPreset, JobClosureReason } from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";
import { isPushRegistrationError } from "@/lib/push-notifications";

import type { StudioJobsTimeFilter } from "./use-studio-feed-controller";

export type StudioControllerJob = {
  applications: Array<{
    applicationId: Id<"jobApplications">;
    appliedAt: number;
    instructorName: string;
    message?: string | null;
    status: "pending" | "accepted" | "rejected" | "withdrawn";
  }>;
  applicationsCount: number;
  applicationDeadline?: number;
  boostActive?: boolean;
  boostBonusAmount?: number;
  boostPreset?: BoostPreset;
  closureReason?: JobClosureReason;
  endTime: number;
  jobId: Id<"jobs">;
  pendingApplicationsCount: number;
  pay: number;
  payment?: {
    paymentId: Id<"payments">;
    payoutStatus: PayoutStatus | null;
    status: PaymentStatus;
  } | null;
  sport: string;
  startTime: number;
  status: "open" | "filled" | "cancelled" | "completed";
  zone: string;
};

export function getStudioPushErrorMessage(error: unknown, t: TFunction): string {
  if (isPushRegistrationError(error)) {
    switch (error.code) {
      case "permission_denied":
        return t("jobsTab.errors.pushPermissionRequired");
      case "expo_go_unsupported":
        return t("jobsTab.errors.pushUnavailableInExpoGo");
      case "physical_device_required":
        return t("jobsTab.errors.pushRequiresPhysicalDevice");
      case "native_module_unavailable":
        return t("jobsTab.errors.pushUnavailableInBuild");
      case "web_unsupported":
        return t("jobsTab.errors.pushUnsupportedOnWeb");
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : t("jobsTab.errors.failedToEnablePush");
}

export function filterStudioJobsByTime(
  studioJobs: StudioControllerJob[] | undefined,
  jobsTimeFilter: StudioJobsTimeFilter,
  now: number,
) {
  return (studioJobs ?? []).filter((job: StudioControllerJob) => {
    if (jobsTimeFilter === "all") {
      return true;
    }

    const isPastJob =
      job.status === "completed" || job.status === "cancelled" || job.startTime < now;

    if (jobsTimeFilter === "past" && !isPastJob) {
      return false;
    }
    if (jobsTimeFilter === "active" && isPastJob) {
      return false;
    }
    return true;
  });
}

export function buildLatestPaymentByJobId(
  studioPayments:
    | Array<{
        payment: {
          _id: Id<"payments">;
          jobId: Id<"jobs">;
          status:
            | "created"
            | "pending"
            | "authorized"
            | "captured"
            | "failed"
            | "cancelled"
            | "refunded";
        };
        payout?: {
          status:
            | "queued"
            | "processing"
            | "pending_provider"
            | "paid"
            | "failed"
            | "cancelled"
            | "needs_attention";
        } | null;
      }>
    | undefined,
) {
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
}
