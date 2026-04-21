import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import { omitUndefined } from "../lib/validation";
import { ensureJobBillingPolicy, transitionJobSettlementPolicy } from "../policy/billing";
import { auditPaymentOfferCreated, auditPaymentOrderCreated } from "../lib/audit";
import { loadJobContext } from "./helpers";
import { normalizeOptionalText, toAgorot } from "./mutationUtils";
import { mirrorPaymentOffer, mirrorPaymentOrder } from "./neutralMirror";
import { refreshPaymentOrderSummary } from "./summaries";
import { computePricing } from "./pricing";
import { projectPaymentOffer, projectPaymentOrder } from "./projectors";
import {
  DEFAULT_PROVIDER_COUNTRY,
  DEFAULT_PROVIDER_CURRENCY,
  paymentOfferSummaryValidator,
  paymentOrderSummaryValidator,
} from "./validators";

/**
 * Helper function to check if parameters match for idempotency validation
 */
function pricingMatches(
  existingPricing: {
    baseLessonAmountAgorot: number;
    bonusAmountAgorot: number;
    instructorOfferAmountAgorot: number;
    platformServiceFeeAgorot: number;
    studioChargeAmountAgorot: number;
  },
  newPricing: typeof existingPricing,
): boolean {
  return (
    existingPricing.baseLessonAmountAgorot === newPricing.baseLessonAmountAgorot &&
    existingPricing.bonusAmountAgorot === newPricing.bonusAmountAgorot &&
    existingPricing.instructorOfferAmountAgorot === newPricing.instructorOfferAmountAgorot &&
    existingPricing.platformServiceFeeAgorot === newPricing.platformServiceFeeAgorot &&
    existingPricing.studioChargeAmountAgorot === newPricing.studioChargeAmountAgorot
  );
}

/**
 * createPaymentOffer: Create a payment offer for a job.
 * 
 * AUDIT: Logs payment offer creation for security and compliance.
 */
export const createPaymentOffer = mutation({
  args: {
    jobId: v.id("jobs"),
    bonusAmountAgorot: v.optional(v.number()),
    bonusReason: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  returns: paymentOfferSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, studio, job, instructor, instructorUserId, assignment } = await loadJobContext(
      ctx,
      args.jobId,
    );

    const baseLessonAmountAgorot = toAgorot(job.pay);
    const bonusAmountAgorot = Math.max(0, Math.round(args.bonusAmountAgorot ?? 0));
    const pricing = computePricing({
      baseLessonAmountAgorot,
      bonusAmountAgorot,
      country: DEFAULT_PROVIDER_COUNTRY,
      currency: DEFAULT_PROVIDER_CURRENCY,
    });

    // Idempotency check: If an idempotency key is provided, look for an existing offer
    if (args.idempotencyKey) {
      const existingByKey = await ctx.db
        .query("paymentOffers")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .unique();

      if (existingByKey) {
        // Verify the parameters match - if they don't, reject with error
        if (!pricingMatches(existingByKey.pricing, pricing)) {
          throw new ConvexError({
            code: "IDEMPOTENCY_PARAM_MISMATCH",
            message:
              "Idempotency key was already used with different parameters. A new idempotency key is required for different payment amounts.",
          });
        }
        if (existingByKey.bonusReason !== normalizeOptionalText(args.bonusReason)) {
          throw new ConvexError({
            code: "IDEMPOTENCY_PARAM_MISMATCH",
            message:
              "Idempotency key was already used with different bonus reason. A new idempotency key is required for different parameters.",
          });
        }
        // Parameters match - return the existing record (idempotent behavior)
        await mirrorPaymentOffer(ctx, existingByKey);
        return projectPaymentOffer(existingByKey);
      }
    }

    const latestOffer = await ctx.db
      .query("paymentOffers")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .order("desc")
      .first();

    if (
      latestOffer &&
      latestOffer.status !== "cancelled" &&
      latestOffer.status !== "paid" &&
      pricingMatches(latestOffer.pricing, pricing)
    ) {
      // Idempotency: Even without explicit key, if an equivalent offer exists, return it
      // Store the idempotency key on the existing offer if provided
      if (args.idempotencyKey && !latestOffer.idempotencyKey) {
        await ctx.db.patch(latestOffer._id, {
          idempotencyKey: args.idempotencyKey,
          updatedAt: now,
        });
        const updatedOffer = await ctx.db.get("paymentOffers", latestOffer._id);
        if (updatedOffer) {
          await mirrorPaymentOffer(ctx, updatedOffer);
          return projectPaymentOffer(updatedOffer);
        }
      }
      await mirrorPaymentOffer(ctx, latestOffer);
      return projectPaymentOffer(latestOffer);
    }

    if (latestOffer && latestOffer.status === "ready") {
      await ctx.db.patch(latestOffer._id, {
        status: "superseded",
        updatedAt: now,
      });
    }

    const offerId = await ctx.db.insert("paymentOffers", {
      jobId: job._id,
      studioId: studio._id,
      studioUserId: user._id,
      instructorId: instructor._id,
      instructorUserId,
      providerCountry: DEFAULT_PROVIDER_COUNTRY,
      currency: DEFAULT_PROVIDER_CURRENCY,
      pricing,
      pricingSnapshot: {
        pricingRuleVersion: pricing.pricingRuleVersion,
        feeMode: pricing.feeMode,
        hasBonus: pricing.hasBonus,
      },
      ...omitUndefined({
        bonusReason: normalizeOptionalText(args.bonusReason),
        idempotencyKey: args.idempotencyKey,
      }),
      status: "ready",
      createdAt: now,
      updatedAt: now,
    });

    const offer = await ctx.db.get("paymentOffers", offerId);
    if (!offer) {
      throw new ConvexError("Failed to create payment offer");
    }
    await ensureJobBillingPolicy(ctx, job);
    await transitionJobSettlementPolicy(ctx, {
      job,
      instructorId: instructor._id,
      instructorUserId,
      assignmentId: assignment?._id,
      paymentOfferId: offer._id,
      paymentStatus: "payment_pending",
      settlementStatus: "pending",
    });
    await mirrorPaymentOffer(ctx, offer);

    // Audit: Payment offer created successfully
    await auditPaymentOfferCreated(ctx, {
      actor: { _id: user._id, email: user.email, role: user.role },
      offerId: offer._id,
      jobId: job._id,
      studioId: studio._id,
      instructorId: instructor._id,
      amountAgorot: pricing.studioChargeAmountAgorot,
      success: true,
    });

    return projectPaymentOffer(offer);
  },
});

export const createPaymentOrder = mutation({
  args: {
    offerId: v.id("paymentOffers"),
    idempotencyKey: v.optional(v.string()),
  },
  returns: paymentOrderSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["studio"]);
    const offer = await ctx.db.get("paymentOffers", args.offerId);
    if (!offer) {
      throw new ConvexError("Payment offer not found");
    }
    if (offer.studioUserId !== user._id) {
      throw new ConvexError("Unauthorized payment offer");
    }
    if (offer.status !== "ready" && offer.status !== "draft") {
      throw new ConvexError("Payment offer is not payable");
    }

    // Idempotency check: If an idempotency key is provided, look for an existing order
    if (args.idempotencyKey) {
      const existingByKey = await ctx.db
        .query("paymentOrders")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .unique();

      if (existingByKey) {
        // Verify the order is for the same offer - if not, reject with error
        if (existingByKey.offerId !== offer._id) {
          throw new ConvexError({
            code: "IDEMPOTENCY_PARAM_MISMATCH",
            message:
              "Idempotency key was already used with a different payment offer. A new idempotency key is required for different offers.",
          });
        }
        // Same offer - return the existing record (idempotent behavior)
        await mirrorPaymentOrder(ctx, existingByKey);
        await refreshPaymentOrderSummary(ctx, existingByKey);
        return projectPaymentOrder(existingByKey);
      }
    }

    const existingOrder = await ctx.db
      .query("paymentOrders")
      .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
      .order("desc")
      .first();
    if (existingOrder) {
      // Idempotency: Store the idempotency key on the existing order if provided
      if (args.idempotencyKey && !existingOrder.idempotencyKey) {
        await ctx.db.patch(existingOrder._id, {
          idempotencyKey: args.idempotencyKey,
          updatedAt: now,
        });
        const updatedOrder = await ctx.db.get("paymentOrders", existingOrder._id);
        if (updatedOrder) {
          await mirrorPaymentOrder(ctx, updatedOrder);
          await refreshPaymentOrderSummary(ctx, updatedOrder);
          return projectPaymentOrder(updatedOrder);
        }
      }
      await mirrorPaymentOrder(ctx, existingOrder);
      await refreshPaymentOrderSummary(ctx, existingOrder);
      return projectPaymentOrder(existingOrder);
    }

    const correlationKey = `stripe:${offer._id}:${offer.jobId}:${crypto.randomUUID()}`;
    const orderId = await ctx.db.insert("paymentOrders", {
      offerId: offer._id,
      jobId: offer.jobId,
      studioId: offer.studioId,
      studioUserId: offer.studioUserId,
      instructorId: offer.instructorId,
      instructorUserId: offer.instructorUserId,
      provider: "stripe",
      status: "draft",
      providerCountry: offer.providerCountry,
      currency: offer.currency,
      pricing: offer.pricing,
      capturedAmountAgorot: 0,
      refundedAmountAgorot: 0,
      correlationKey,
      ...omitUndefined({
        idempotencyKey: args.idempotencyKey,
      }),
      createdAt: now,
      updatedAt: now,
    });

    const order = await ctx.db.get("paymentOrders", orderId);
    if (!order) {
      throw new ConvexError("Failed to create payment order");
    }
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
        paymentOfferId: order.offerId ?? undefined,
        paymentOrderId: order._id,
        paymentStatus: "payment_processing",
        settlementStatus: "awaiting_capture",
      });
    }
    await mirrorPaymentOrder(ctx, order);
    await refreshPaymentOrderSummary(ctx, order);

    // Audit: Payment order created successfully
    await auditPaymentOrderCreated(ctx, {
      actor: { _id: user._id, email: user.email, role: user.role },
      orderId: order._id,
      offerId: offer._id,
      jobId: offer.jobId,
      studioId: offer.studioId,
      instructorId: offer.instructorId,
      amountAgorot: offer.pricing.studioChargeAmountAgorot,
      success: true,
    });

    return projectPaymentOrder(order);
  },
});
