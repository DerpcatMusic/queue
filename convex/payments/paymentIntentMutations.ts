import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import { transitionJobSettlementPolicy } from "../policy/billing";
import { mirrorPaymentAttempt, mirrorPaymentOrder } from "./neutralMirror";
import { refreshPaymentOrderSummary } from "./summaries";
import { paymentOrderStatusValidator } from "./validators";

export const recordStripePaymentIntentAttempt = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrders"),
    providerPaymentIntentId: v.string(),
    clientSecretRef: v.optional(v.string()),
    status: paymentOrderStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.id("paymentAttempts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...omitUndefined({
          clientSecretRef: args.clientSecretRef,
          statusRaw: args.statusRaw,
          metadata: args.metadata,
        }),
        status: args.status,
        updatedAt: now,
      });
      const updated = await ctx.db.get(existing._id);
      if (updated) {
        await mirrorPaymentAttempt(ctx, updated as any);
        const order = await ctx.db.get(updated.paymentOrderId);
        if (order) {
          await refreshPaymentOrderSummary(ctx, order);
        }
      }
      return existing._id;
    }

    const attemptId = await ctx.db.insert("paymentAttempts", {
      paymentOrderId: args.paymentOrderId,
      provider: "stripe",
      providerPaymentIntentId: args.providerPaymentIntentId,
      ...omitUndefined({
        clientSecretRef: args.clientSecretRef,
        statusRaw: args.statusRaw,
        metadata: args.metadata,
      }),
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.paymentOrderId, {
      status: args.status,
      latestError: undefined,
      updatedAt: now,
    });
    const order = await ctx.db.get(args.paymentOrderId);
    const job = order ? await ctx.db.get("jobs", order.jobId) : null;
    if (order && job) {
      const assignmentRows = await ctx.db
        .query("jobAssignments")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const assignment =
        assignmentRows.find(
          (row) => row.instructorId === order.instructorId && row.status === "accepted",
        ) ?? null;
      await transitionJobSettlementPolicy(ctx, {
        job,
        instructorId: order.instructorId,
        instructorUserId: order.instructorUserId,
        assignmentId: assignment?._id,
        paymentOrderId: order._id,
        paymentStatus: args.status === "succeeded" ? "paid" : "payment_processing",
        settlementStatus: args.status === "succeeded" ? "settled" : "awaiting_capture",
        ...(args.status === "succeeded" ? { paidAt: now } : {}),
      } as any);
    }

    const attempt = await ctx.db.get(attemptId);
    if (attempt) {
      await mirrorPaymentAttempt(ctx, attempt as any);
    }
    if (order) {
      await refreshPaymentOrderSummary(ctx, order);
    }

    return attemptId;
  },
});

export const applyStripePaymentIntentWebhook = internalMutation({
  args: {
    providerPaymentIntentId: v.string(),
    status: paymentOrderStatusValidator,
    statusRaw: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();

    if (!attempt) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      ...omitUndefined({
        statusRaw: args.statusRaw,
        lastError: args.errorMessage,
        metadata: args.metadata
          ? {
              ...(attempt.metadata ?? {}),
              ...args.metadata,
            }
          : undefined,
      }),
      status: args.status,
      updatedAt: now,
    });

    const order = await ctx.db.get(attempt.paymentOrderId);
    if (!order) {
      return null;
    }

    await ctx.db.patch(order._id, {
      status: args.status,
      capturedAmountAgorot:
        args.status === "succeeded"
          ? order.pricing!.studioChargeAmountAgorot
          : order.capturedAmountAgorot,
      latestError: args.errorMessage,
      updatedAt: now,
      ...omitUndefined({
        succeededAt: args.status === "succeeded" ? now : undefined,
        cancelledAt: args.status === "cancelled" ? now : undefined,
      }),
    });
    const updatedOrder = await ctx.db.get(order._id);
    const job = updatedOrder ? await ctx.db.get("jobs", updatedOrder.jobId) : null;
    if (updatedOrder && job) {
      const assignmentRows = await ctx.db
        .query("jobAssignments")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const assignment =
        assignmentRows.find(
          (row) => row.instructorId === updatedOrder.instructorId && row.status === "accepted",
        ) ?? null;
      await transitionJobSettlementPolicy(ctx, {
        job,
        instructorId: updatedOrder.instructorId,
        instructorUserId: updatedOrder.instructorUserId,
        assignmentId: assignment?._id,
        paymentOrderId: updatedOrder._id,
        paymentStatus:
          args.status === "succeeded"
            ? "paid"
            : args.status === "cancelled" || args.status === "failed"
              ? "failed"
              : "payment_processing",
        settlementStatus:
          args.status === "succeeded"
            ? job.status === "completed"
              ? "settled"
              : "awaiting_lesson"
            : args.status === "cancelled" || args.status === "failed"
              ? "ready_for_payment"
              : "awaiting_capture",
        ...(args.status === "succeeded" ? { paidAt: now } : {}),
      } as any);
    }

    const updatedAttempt = await ctx.db.get(attempt._id);
    if (updatedAttempt) {
      await mirrorPaymentAttempt(ctx, updatedAttempt as any);
    }
    const nextOrder = updatedOrder ?? order;
    await mirrorPaymentOrder(ctx, nextOrder as any);
    if (nextOrder) {
      await refreshPaymentOrderSummary(ctx, nextOrder);
    }

    return null;
  },
});

export const markPaymentOrderProcessing = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const order = await ctx.db.get("paymentOrders", args.paymentOrderId);
    if (!order) {
      throw new ConvexError("Payment order not found");
    }
    if (order.status === "succeeded" || order.status === "refunded") {
      return null;
    }
    await ctx.db.patch(order._id, {
      status: "processing",
      updatedAt: now,
    });
    const job = await ctx.db.get("jobs", order.jobId);
    if (job) {
      const assignmentRows = await ctx.db
        .query("jobAssignments")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const assignment =
        assignmentRows.find(
          (row) => row.instructorId === order.instructorId && row.status === "accepted",
        ) ?? null;
      await transitionJobSettlementPolicy(ctx, {
        job,
        instructorId: order.instructorId,
        instructorUserId: order.instructorUserId,
        assignmentId: assignment?._id,
        paymentOrderId: order._id,
        paymentStatus: "payment_processing",
        settlementStatus: "awaiting_capture",
      } as any);
    }
    await refreshPaymentOrderSummary(ctx, order);
    return null;
  },
});
