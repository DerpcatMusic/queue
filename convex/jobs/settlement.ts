import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { releaseStudioOperationalBlocks, upsertStudioOperationalBlock } from "./lifecycle";

export const enforceOverdueSettlementStates = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    blockedStudios: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const candidateStatuses = ["pending", "ready_for_payment", "awaiting_capture"] as const;
    const candidates = (
      await Promise.all(
        candidateStatuses.map((status) =>
          ctx.db
            .query("jobSettlementStates")
            .withIndex("by_status_due", (q) => q.eq("settlementStatus", status))
            .take(limit),
        ),
      )
    )
      .flat()
      .slice(0, limit);

    let processed = 0;
    const blockedStudioIds = new Set<string>();

    for (const candidate of candidates) {
      if (!candidate.dueAt || candidate.dueAt > now) {
        continue;
      }
      if (candidate.paymentStatus === "paid") {
        continue;
      }

      await ctx.db.patch(candidate._id, {
        paymentStatus: "overdue",
        settlementStatus: "overdue",
        overdueAt: candidate.overdueAt ?? now,
        suspendedStudioAt: candidate.suspendedStudioAt ?? now,
        updatedAt: now,
      });
      const studio = await ctx.db.get("studioProfiles", candidate.studioId);
      if (studio) {
        await upsertStudioOperationalBlock(ctx, {
          studioId: studio._id,
          userId: studio.userId,
          reason: "overdue_payment",
          scope: "post_jobs",
          detail: "Outstanding instructor settlement is overdue",
          triggeredByJobId: candidate.jobId,
          triggeredBySettlementStateId: candidate._id,
        });
        blockedStudioIds.add(String(studio._id));
      }
      processed += 1;
    }

    return {
      processed,
      blockedStudios: blockedStudioIds.size,
    };
  },
});

export const releaseRecoveredStudioPaymentBlocks = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    releasedStudios: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const activeBlocks = await ctx.db
      .query("studioOperationalBlocks")
      .withIndex("by_active_reason", (q) => q.eq("active", true).eq("reason", "overdue_payment"))
      .take(limit);

    const releasedStudioIds = new Set<string>();
    for (const block of activeBlocks) {
      const remainingOverdue = await ctx.db
        .query("jobSettlementStates")
        .withIndex("by_studio_status_due", (q) =>
          q.eq("studioId", block.studioId).eq("settlementStatus", "overdue"),
        )
        .first();
      if (remainingOverdue) {
        continue;
      }

      await releaseStudioOperationalBlocks(ctx, block.studioId, "overdue_payment");
      releasedStudioIds.add(String(block.studioId));
    }

    return {
      releasedStudios: releasedStudioIds.size,
    };
  },
});
