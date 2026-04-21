import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireCurrentUser, requireUserRole } from "../lib/auth";
import { omitUndefined } from "../lib/validation";
import { loadPaymentOrderSummariesByOrderIds } from "./summaries";
import { loadLatestPaymentChildrenByOrderIds } from "./readModels";
import {
  type LegacyPaymentStatus,
  type LegacyPayoutStatus,
  mapFundSplitStatusToLegacy,
  mapPaymentOrderStatusToLegacy,
  mapPayoutTransferStatusToLegacy,
} from "./statuses";

export async function listPaymentOrdersForCurrentUser(
  ctx: Parameters<typeof requireCurrentUser>[0],
  args: { limit?: number },
) {
  const user = await requireCurrentUser(ctx);
  const rawLimit = Math.floor(args.limit ?? 20);
  const limit = Math.min(Math.max(rawLimit, 1), 300);

  let orders: Doc<"paymentOrders">[] = [];
  if (user.role === "studio") {
    orders = await ctx.db
      .query("paymentOrders")
      .withIndex("by_studio_user", (q) => q.eq("studioUserId", user._id))
      .order("desc")
      .take(limit);
  } else if (user.role === "instructor") {
    orders = await ctx.db
      .query("paymentOrders")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
      .order("desc")
      .take(limit);
  }

  if (orders.length === 0) {
    return [] as Array<{
      payment: {
        _id: Id<"paymentOrders">;
        jobId: Id<"jobs">;
        status: LegacyPaymentStatus;
        currency: string;
        studioChargeAmountAgorot: number;
        instructorBaseAmountAgorot: number;
        platformMarkupAmountAgorot: number;
        createdAt: number;
      };
      payout: {
        status: LegacyPayoutStatus;
        settledAt?: number;
      } | null;
      job: {
        _id: Id<"jobs">;
        sport: string;
        startTime: number;
        status: Doc<"jobs">["status"];
      } | null;
    }>;
  }

  const [jobs, summaries] = await Promise.all([
    Promise.all(orders.map((order) => ctx.db.get("jobs", order.jobId))),
    loadPaymentOrderSummariesByOrderIds(ctx, orders.map((order) => order._id)),
  ]);

  const missingOrders = orders.filter((order) => !summaries.has(String(order._id)));
  const latestChildren = missingOrders.length
    ? await loadLatestPaymentChildrenByOrderIds(
        ctx,
        missingOrders.map((order) => order._id),
      )
    : {
        latestAttemptByOrderId: new Map<string, Doc<"paymentAttempts">>(),
        latestSplitByOrderId: new Map<string, Doc<"fundSplits">>(),
        latestTransferByOrderId: new Map<string, Doc<"payoutTransfers">>(),
      };

  return orders.map((order, index) => {
    const summary = summaries.get(String(order._id)) ?? null;
    const latestSplit =
      summary?.latestSplitStatus !== undefined
        ? ({
            status: summary.latestSplitStatus,
            settledAt: summary.latestSplitSettledAt,
          } as Doc<"fundSplits">)
        : latestChildren.latestSplitByOrderId.get(String(order._id)) ?? null;
    const latestTransfer =
      summary?.latestTransferStatus !== undefined
        ? ({
            status: summary.latestTransferStatus,
            paidAt: summary.latestTransferPaidAt,
          } as Doc<"payoutTransfers">)
        : latestChildren.latestTransferByOrderId.get(String(order._id)) ?? null;
    const job = jobs[index];
    const latestAttemptStatus = summary?.latestAttemptStatus;
    const latestAttempt =
      latestAttemptStatus !== undefined
        ? ({
            status: latestAttemptStatus,
          } as Doc<"paymentAttempts">)
        : latestChildren.latestAttemptByOrderId.get(String(order._id)) ?? null;
    const legacyPaymentStatus = mapPaymentOrderStatusToLegacy(summary?.status ?? order.status);

    return {
      payment: {
        _id: order._id,
        jobId: order.jobId,
        status: latestAttempt?.status === "succeeded" ? "captured" : legacyPaymentStatus,
        currency: summary?.currency ?? order.currency,
        studioChargeAmountAgorot:
          summary?.studioChargeAmountAgorot ?? order.pricing!.studioChargeAmountAgorot,
        instructorBaseAmountAgorot:
          summary?.instructorBaseAmountAgorot ?? order.pricing!.instructorOfferAmountAgorot,
        platformMarkupAmountAgorot:
          summary?.platformMarkupAmountAgorot ?? order.pricing!.platformServiceFeeAgorot,
        createdAt: summary?.createdAt ?? order.createdAt,
      },
      payout: latestTransfer
        ? {
            status: mapPayoutTransferStatusToLegacy(latestTransfer.status),
            ...omitUndefined({
              settledAt: latestTransfer.paidAt,
            }),
          }
        : latestSplit
          ? {
              status: mapFundSplitStatusToLegacy(latestSplit.status),
              ...omitUndefined({
                settledAt: latestSplit.settledAt,
              }),
            }
          : null,
      job: job
        ? {
            _id: job._id,
            sport: job.sport,
            startTime: job.startTime,
            status: job.status,
          }
        : null,
    };
  });
}

export async function loadLatestConnectedAccountForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  provider?: Doc<"connectedAccounts">["provider"],
) {
  const accounts = await ctx.db
    .query("connectedAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  return provider
    ? (accounts.find((account) => account.provider === provider) ?? null)
    : (accounts[0] ?? null);
}

export async function loadCurrentStudio(ctx: Parameters<typeof requireUserRole>[0]) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studio = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();
  if (!studio) {
    throw new ConvexError("Studio profile not found");
  }
  return { user, studio };
}

export async function loadJobContext(
  ctx: Parameters<typeof requireUserRole>[0],
  jobId: Id<"jobs">,
) {
  const { user, studio } = await loadCurrentStudio(ctx);
  const job = await ctx.db.get("jobs", jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }
  if (job.studioId !== studio._id) {
    throw new ConvexError("Unauthorized job");
  }
  if (!job.filledByInstructorId) {
    throw new ConvexError("Job is not assigned to an instructor yet");
  }

  const instructor = await ctx.db.get("instructorProfiles", job.filledByInstructorId);
  if (!instructor) {
    throw new ConvexError("Instructor profile not found");
  }
  const assignmentRows = await ctx.db
    .query("jobAssignments")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .collect();
  const assignment =
    assignmentRows.find(
      (row) => row.instructorId === instructor._id && row.status === "accepted",
    ) ?? null;

  const instructorUserId = instructor.userId;

  return { user, studio, job, instructor, instructorUserId, assignment };
}
