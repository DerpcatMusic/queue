import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalMutation } from "./_generated/server";
import { verifyAirwallexWebhookSignature } from "./integrations/airwallex/client";
import { omitUndefined } from "./lib/validation";

const webhookRouteValidator = v.union(
  v.literal("payment"),
  v.literal("payout"),
  v.literal("beneficiary"),
  v.literal("kyc"),
  v.literal("connected_account"),
  v.literal("fund_split"),
);

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const AIRWALLEX_PROVIDER = "airwallex" as const;

type WebhookRoute =
  | "payment"
  | "payout"
  | "beneficiary"
  | "kyc"
  | "connected_account"
  | "fund_split";
type PaymentOrderStatus =
  | "draft"
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled";
type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";
type FundSplitStatus =
  | "pending_create"
  | "created"
  | "released"
  | "settled"
  | "failed"
  | "reversed";
type WebhookProcessingSummary = {
  paymentOrderId?: Id<"paymentOrdersV2">;
  shouldEnsureFundSplit: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toAgorot = (value: unknown): number => Math.max(0, Math.round((asNumber(value) ?? 0) * 100));

const getEventType = (payload: Record<string, unknown>): string | undefined =>
  asString(payload.name) ?? asString(payload.type) ?? asString(payload.event_type);

const getEventObject = (payload: Record<string, unknown>): Record<string, unknown> | null => {
  const data = asRecord(payload.data);
  if (!data) {
    return null;
  }
  return asRecord(data.object) ?? data;
};

const inferRoute = (
  payload: Record<string, unknown>,
  eventType: string | undefined,
): WebhookRoute => {
  const objectType = asString(payload.object_type) ?? asString(payload.entity_type);
  if (objectType === "connected_account") return "connected_account";
  if (objectType === "fund_split") return "fund_split";
  if (objectType === "payout") return "payout";
  if (objectType === "kyc") return "kyc";
  if (objectType === "beneficiary") return "beneficiary";
  if (eventType?.startsWith("account.")) return "connected_account";
  if (eventType?.startsWith("funds_split.")) return "fund_split";
  if (eventType?.startsWith("connected_account_transfer.")) return "payout";
  return "payment";
};

const mapPaymentOrderStatus = (
  statusRaw: string | undefined,
  eventType: string | undefined,
): PaymentOrderStatus => {
  const normalized = statusRaw?.trim().toUpperCase();
  if (eventType === "payment_intent.succeeded" || normalized === "SUCCEEDED") {
    return "succeeded";
  }
  if (
    eventType === "payment_intent.cancelled" ||
    normalized === "CANCELLED" ||
    normalized === "CANCELED"
  ) {
    return "cancelled";
  }
  if (normalized === "FAILED") {
    return "failed";
  }
  if (normalized === "REQUIRES_PAYMENT_METHOD") {
    return "requires_payment_method";
  }
  return "processing";
};

const mapConnectedAccountStatus = (
  statusRaw: string | undefined,
  eventType: string | undefined,
): ConnectedAccountStatus => {
  const normalized = statusRaw?.trim().toUpperCase();
  if (eventType === "account.active" || normalized === "ACTIVE") {
    return "active";
  }
  if (eventType === "account.action_required" || normalized === "ACTION_REQUIRED") {
    return "action_required";
  }
  if (eventType === "account.suspended" || normalized === "SUSPENDED") {
    return "restricted";
  }
  if (normalized === "REJECTED") {
    return "rejected";
  }
  if (normalized === "DISABLED") {
    return "disabled";
  }
  return "pending";
};

const mapFundSplitStatus = (
  statusRaw: string | undefined,
  eventType: string | undefined,
): FundSplitStatus => {
  const normalized = statusRaw?.trim().toUpperCase();
  if (eventType === "funds_split.failed" || normalized === "FAILED") {
    return "failed";
  }
  if (eventType === "funds_split.settled" || normalized === "SETTLED") {
    return "settled";
  }
  if (eventType === "funds_split.released" || normalized === "RELEASED") {
    return "released";
  }
  if (normalized === "REVERSED") {
    return "reversed";
  }
  if (eventType === "funds_split.created" || normalized === "CREATED") {
    return "created";
  }
  return "pending_create";
};

const mapPayoutTransferStatus = (
  statusRaw: string | undefined,
  eventType: string | undefined,
): "pending" | "processing" | "sent" | "paid" | "failed" | "cancelled" | "needs_attention" => {
  const normalized = statusRaw?.trim().toUpperCase();
  if (
    eventType === "connected_account_transfer.settled" ||
    normalized === "SETTLED" ||
    normalized === "PAID"
  ) {
    return "paid";
  }
  if (eventType === "connected_account_transfer.failed" || normalized === "FAILED") {
    return "failed";
  }
  if (normalized === "SENT") {
    return "sent";
  }
  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return "cancelled";
  }
  if (normalized === "SUSPENDED") {
    return "needs_attention";
  }
  if (normalized === "NEW" || normalized === "PENDING") {
    return "pending";
  }
  return "processing";
};

const flattenRequirementEntries = (
  requirements: Record<string, unknown> | undefined,
): Array<{
  providerRequirementId: string;
  kind: "agreement" | "identity" | "business" | "bank_account" | "payment_method" | "other";
  code?: string;
  message: string;
  blocking: boolean;
}> => {
  if (!requirements) {
    return [];
  }

  return Object.entries(requirements).flatMap(([key, value]) => {
    const record = asRecord(value);
    const message =
      asString(record?.message) ??
      (typeof value === "string" ? value : undefined) ??
      key.replaceAll("_", " ");
    if (!message) {
      return [];
    }
    const normalizedKey = key.toLowerCase();
    const kind = normalizedKey.includes("bank")
      ? "bank_account"
      : normalizedKey.includes("term")
        ? "agreement"
        : normalizedKey.includes("identity") || normalizedKey.includes("kyc")
          ? "identity"
          : "other";
    return [
      {
        providerRequirementId: key,
        kind,
        message,
        blocking: true,
        ...omitUndefined({
          code: asString(record?.code),
        }),
      },
    ];
  });
};

async function upsertProviderObject(
  ctx: { db: { query: Function; insert: Function } },
  args: {
    entityType:
      | "payment_order"
      | "payment_attempt"
      | "connected_account"
      | "fund_split"
      | "payout_transfer";
    entityId: string;
    providerObjectType: string;
    providerObjectId: string;
  },
) {
  const existing = await ctx.db
    .query("providerObjectsV2")
    .withIndex("by_provider_object", (q: any) =>
      q
        .eq("provider", AIRWALLEX_PROVIDER)
        .eq("providerObjectType", args.providerObjectType)
        .eq("providerObjectId", args.providerObjectId),
    )
    .unique();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("providerObjectsV2", {
    provider: AIRWALLEX_PROVIDER,
    entityType: args.entityType,
    entityId: args.entityId,
    providerObjectType: args.providerObjectType,
    providerObjectId: args.providerObjectId,
    createdAt: Date.now(),
  });
}

export const recordAirwallexWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    route: webhookRouteValidator,
    eventType: v.optional(v.string()),
    payloadHash: v.string(),
    payload: v.any(),
    signatureValid: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("integrationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", "airwallex").eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing) {
      return null;
    }

    await ctx.db.insert("integrationEvents", {
      provider: "airwallex",
      route: args.route,
      providerEventId: args.providerEventId,
      signatureValid: args.signatureValid,
      payloadHash: args.payloadHash,
      payload: args.payload,
      processingState: "pending",
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        eventType: args.eventType,
      }),
    });

    return null;
  },
});

export const finalizeAirwallexWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    processingState: v.union(v.literal("processed"), v.literal("failed")),
    processingError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("integrationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", AIRWALLEX_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (!event) {
      return null;
    }
    await ctx.db.patch(event._id, {
      processingState: args.processingState,
      updatedAt: Date.now(),
      processedAt: args.processingState === "processed" ? Date.now() : undefined,
      processingError: args.processingError,
    });
    return null;
  },
});

export const processAirwallexWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
  },
  returns: v.object({
    paymentOrderId: v.optional(v.id("paymentOrdersV2")),
    shouldEnsureFundSplit: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const event = await ctx.db
      .query("integrationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", AIRWALLEX_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (!event) {
      throw new ConvexError("Airwallex integration event not found");
    }
    if (event.processingState === "processed") {
      return {
        shouldEnsureFundSplit: false,
      };
    }

    const payload = asRecord(event.payload);
    if (!payload) {
      throw new ConvexError("Airwallex webhook payload must be an object");
    }

    const eventType = getEventType(payload) ?? event.eventType;
    const object = getEventObject(payload);

    if (event.route === "payment") {
      const providerPaymentIntentId = asString(object?.id);
      if (!providerPaymentIntentId) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const attempt = await ctx.db
        .query("paymentAttemptsV2")
        .withIndex("by_provider_payment_intent", (q) =>
          q
            .eq("provider", AIRWALLEX_PROVIDER)
            .eq("providerPaymentIntentId", providerPaymentIntentId),
        )
        .unique();

      const merchantOrderId = asString(object?.merchant_order_id);
      const order = attempt
        ? await ctx.db.get("paymentOrdersV2", attempt.paymentOrderId)
        : merchantOrderId
          ? ((await ctx.db.get("paymentOrdersV2", merchantOrderId as Id<"paymentOrdersV2">)) ??
            null)
          : null;
      if (!order) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const statusRaw = asString(object?.status);
      const capturedAmountAgorot = toAgorot(
        object?.captured_amount ?? (eventType === "payment_intent.succeeded" ? object?.amount : 0),
      );
      const refundedAmountAgorot = toAgorot(object?.amount_refunded ?? object?.refunded_amount);
      const nextStatus =
        refundedAmountAgorot > 0
          ? refundedAmountAgorot >= capturedAmountAgorot && capturedAmountAgorot > 0
            ? "refunded"
            : "partially_refunded"
          : mapPaymentOrderStatus(statusRaw, eventType);

      if (attempt) {
        await ctx.db.patch(attempt._id, {
          status: nextStatus,
          updatedAt: now,
          ...omitUndefined({
            statusRaw,
            providerAttemptId:
              asString(object?.latest_payment_attempt_id) ??
              asString(object?.payment_attempt_id) ??
              attempt.providerAttemptId,
          }),
        });
        await upsertProviderObject(ctx, {
          entityType: "payment_attempt",
          entityId: String(attempt._id),
          providerObjectType: "payment_intent",
          providerObjectId: providerPaymentIntentId,
        });
      }

      await ctx.db.patch(order._id, {
        status: nextStatus,
        capturedAmountAgorot: Math.max(order.capturedAmountAgorot, capturedAmountAgorot),
        refundedAmountAgorot: Math.max(order.refundedAmountAgorot, refundedAmountAgorot),
        updatedAt: now,
        ...omitUndefined({
          latestError: nextStatus === "failed" ? (eventType ?? statusRaw) : undefined,
          succeededAt: nextStatus === "succeeded" && !order.succeededAt ? now : order.succeededAt,
          cancelledAt: nextStatus === "cancelled" && !order.cancelledAt ? now : order.cancelledAt,
        }),
      });
      await upsertProviderObject(ctx, {
        entityType: "payment_order",
        entityId: String(order._id),
        providerObjectType: "payment_intent",
        providerObjectId: providerPaymentIntentId,
      });

      let shouldEnsureFundSplit = false;
      if (nextStatus === "succeeded") {
        const offer = await ctx.db.get("paymentOffersV2", order.offerId);
        if (offer && offer.status !== "paid") {
          await ctx.db.patch(offer._id, {
            status: "paid",
            updatedAt: now,
          });
        }
        shouldEnsureFundSplit = true;
      }

      return {
        paymentOrderId: order._id,
        shouldEnsureFundSplit,
      };
    }

    if (event.route === "connected_account") {
      const providerAccountId = asString(object?.id) ?? asString(payload.accountId);
      if (!providerAccountId) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const account = await ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_provider_account", (q) =>
          q.eq("provider", AIRWALLEX_PROVIDER).eq("providerAccountId", providerAccountId),
        )
        .unique();
      if (!account) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const statusRaw =
        asString(object?.status) ?? eventType?.replace("account.", "").toUpperCase();
      const nextStatus = mapConnectedAccountStatus(statusRaw, eventType);
      await ctx.db.patch(account._id, {
        status: nextStatus,
        updatedAt: now,
        ...omitUndefined({
          kycStatus: statusRaw ?? account.kycStatus,
          serviceAgreementType:
            asString(object?.service_agreement_type) ?? account.serviceAgreementType,
          defaultPayoutMethod:
            asString(object?.default_payout_method) ?? account.defaultPayoutMethod,
          activatedAt: nextStatus === "active" ? (account.activatedAt ?? now) : account.activatedAt,
          metadata: {
            ...(account.metadata ?? {}),
            ...omitUndefined({
              providerStatusRaw: statusRaw ?? eventType,
            }),
          },
        }),
      });
      await upsertProviderObject(ctx, {
        entityType: "connected_account",
        entityId: String(account._id),
        providerObjectType: "account",
        providerObjectId: providerAccountId,
      });

      const requirements = flattenRequirementEntries(asRecord(object?.requirements) ?? undefined);
      const existingRequirements = await ctx.db
        .query("connectedAccountRequirementsV2")
        .withIndex("by_connected_account", (q) => q.eq("connectedAccountId", account._id))
        .collect();
      for (const existingRequirement of existingRequirements) {
        if (!existingRequirement.resolvedAt) {
          await ctx.db.patch(existingRequirement._id, {
            resolvedAt: now,
            updatedAt: now,
          });
        }
      }
      for (const requirement of requirements) {
        await ctx.db.insert("connectedAccountRequirementsV2", {
          connectedAccountId: account._id,
          providerRequirementId: requirement.providerRequirementId,
          kind: requirement.kind,
          blocking: requirement.blocking,
          message: requirement.message,
          createdAt: now,
          updatedAt: now,
          ...omitUndefined({
            code: requirement.code,
          }),
        });
      }
      return {
        shouldEnsureFundSplit: false,
      };
    }

    if (event.route === "fund_split") {
      const providerFundsSplitId = asString(object?.id);
      const sourcePaymentIntentId = asString(object?.source_id);
      const destinationAccountId = asString(object?.destination);
      if (!sourcePaymentIntentId || !destinationAccountId) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const attempt = await ctx.db
        .query("paymentAttemptsV2")
        .withIndex("by_provider_payment_intent", (q) =>
          q.eq("provider", AIRWALLEX_PROVIDER).eq("providerPaymentIntentId", sourcePaymentIntentId),
        )
        .unique();
      if (!attempt) {
        return {
          shouldEnsureFundSplit: false,
        };
      }
      const order = await ctx.db.get("paymentOrdersV2", attempt.paymentOrderId);
      if (!order) {
        return {
          shouldEnsureFundSplit: false,
        };
      }
      const connectedAccount = await ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_provider_account", (q) =>
          q.eq("provider", AIRWALLEX_PROVIDER).eq("providerAccountId", destinationAccountId),
        )
        .unique();
      if (!connectedAccount) {
        return {
          shouldEnsureFundSplit: false,
        };
      }

      const statusRaw = asString(object?.status);
      const nextStatus = mapFundSplitStatus(statusRaw, eventType);
      const amountAgorot = toAgorot(object?.amount);
      const autoRelease = Boolean(object?.auto_release);
      const existingSplit =
        (providerFundsSplitId
          ? await ctx.db
              .query("fundSplitsV2")
              .withIndex("by_provider_split", (q) =>
                q
                  .eq("provider", AIRWALLEX_PROVIDER)
                  .eq("providerFundsSplitId", providerFundsSplitId),
              )
              .unique()
          : null) ??
        (await ctx.db
          .query("fundSplitsV2")
          .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
          .order("desc")
          .first());

      if (existingSplit) {
        await ctx.db.patch(existingSplit._id, {
          status: nextStatus,
          amountAgorot: amountAgorot || existingSplit.amountAgorot,
          updatedAt: now,
          releasedAt:
            nextStatus === "released"
              ? (existingSplit.releasedAt ?? now)
              : existingSplit.releasedAt,
          settledAt:
            nextStatus === "settled" ? (existingSplit.settledAt ?? now) : existingSplit.settledAt,
          ...omitUndefined({
            providerFundsSplitId: providerFundsSplitId ?? existingSplit.providerFundsSplitId,
            failureReason: nextStatus === "failed" ? (eventType ?? statusRaw) : undefined,
          }),
        });
        await upsertProviderObject(ctx, {
          entityType: "fund_split",
          entityId: String(existingSplit._id),
          providerObjectType: "fund_split",
          providerObjectId:
            providerFundsSplitId ?? existingSplit.providerFundsSplitId ?? sourcePaymentIntentId,
        });
        return {
          paymentOrderId: order._id,
          shouldEnsureFundSplit: false,
        };
      }

      const fundSplitId = await ctx.db.insert("fundSplitsV2", {
        paymentOrderId: order._id,
        paymentAttemptId: attempt._id,
        connectedAccountId: connectedAccount._id,
        provider: AIRWALLEX_PROVIDER,
        sourcePaymentIntentId,
        destinationAccountId,
        amountAgorot,
        currency: asString(object?.currency) ?? order.currency,
        autoRelease,
        releaseMode: autoRelease ? "automatic" : "manual",
        status: nextStatus,
        requestId: asString(object?.request_id) ?? args.providerEventId,
        idempotencyKey: `airwallex-fund-split:${providerFundsSplitId ?? sourcePaymentIntentId}`,
        createdAt: now,
        updatedAt: now,
        ...omitUndefined({
          providerFundsSplitId,
          failureReason: nextStatus === "failed" ? (eventType ?? statusRaw) : undefined,
          releasedAt: nextStatus === "released" ? now : undefined,
          settledAt: nextStatus === "settled" ? now : undefined,
        }),
      });
      await upsertProviderObject(ctx, {
        entityType: "fund_split",
        entityId: String(fundSplitId),
        providerObjectType: "fund_split",
        providerObjectId: providerFundsSplitId ?? sourcePaymentIntentId,
      });
      return {
        paymentOrderId: order._id,
        shouldEnsureFundSplit: false,
      };
    }

    if (event.route === "payout") {
      const providerTransferId = asString(object?.id);
      const destinationAccountId = asString(object?.destination);
      if (!providerTransferId || !destinationAccountId) {
        return { shouldEnsureFundSplit: false };
      }

      const connectedAccount = await ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_provider_account", (q) =>
          q.eq("provider", AIRWALLEX_PROVIDER).eq("providerAccountId", destinationAccountId),
        )
        .unique();
      if (!connectedAccount) {
        return { shouldEnsureFundSplit: false };
      }

      // Find the fund split associated with this transfer
      const fundSplit = await ctx.db
        .query("fundSplitsV2")
        .withIndex("by_connected_account", (q) => q.eq("connectedAccountId", connectedAccount._id))
        .filter((q) => q.eq(q.field("destinationAccountId"), destinationAccountId))
        .order("desc")
        .first();

      if (!fundSplit) {
        return { shouldEnsureFundSplit: false };
      }

      const statusRaw = asString(object?.status);
      const nextStatus = mapPayoutTransferStatus(statusRaw, eventType);
      const amountAgorot = toAgorot(object?.amount);
      const requestId = asString(object?.request_id) ?? args.providerEventId;
      const now = Date.now();

      const payoutTransferArgs = {
        fundSplitId: fundSplit._id,
        connectedAccountId: connectedAccount._id,
        providerTransferId,
        amountAgorot: amountAgorot || fundSplit.amountAgorot,
        currency: asString(object?.currency) ?? fundSplit.currency,
        status: nextStatus,
        requestId,
        idempotencyKey: `airwallex-payout-transfer:${providerTransferId}`,
        failureReason: nextStatus === "failed" ? (eventType ?? statusRaw) : undefined,
        paidAt: nextStatus === "paid" ? now : undefined,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payoutTransfer = await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internal.paymentsV2.upsertPayoutTransferFromProviderV2 as unknown as any,
        payoutTransferArgs,
      );

      await upsertProviderObject(ctx, {
        entityType: "payout_transfer",
        entityId: String(payoutTransfer._id),
        providerObjectType: "connected_account_transfer",
        providerObjectId: providerTransferId,
      });

      return { shouldEnsureFundSplit: false };
    }

    return {
      shouldEnsureFundSplit: false,
    };
  },
});

export const airwallexWebhook = httpAction(async (ctx, req) => {
  const payload = await req.text();
  const timestamp = req.headers.get("x-timestamp") ?? "";
  const signature = req.headers.get("x-signature") ?? "";
  const verified = await verifyAirwallexWebhookSignature(payload, timestamp, signature);

  if (!verified) {
    throw new ConvexError("Invalid Airwallex webhook signature");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new ConvexError("Airwallex webhook payload is not valid JSON");
  }

  const eventId =
    (parsed.id as string | undefined) ??
    (parsed.event_id as string | undefined) ??
    `airwallex:${timestamp}:${crypto.randomUUID()}`;
  const eventType = getEventType(parsed);
  const route = inferRoute(parsed, eventType);

  await ctx.runMutation((api as any).webhooksAirwallex.recordAirwallexWebhookEvent, {
    providerEventId: eventId,
    route,
    eventType,
    payloadHash: await sha256Hex(payload),
    payload: parsed,
    signatureValid: verified,
  });

  try {
    const processingSummary: WebhookProcessingSummary = await ctx.runMutation(
      (internal as any).webhooksAirwallex.processAirwallexWebhookEvent,
      {
        providerEventId: eventId,
      },
    );
    if (processingSummary.shouldEnsureFundSplit && processingSummary.paymentOrderId) {
      await ctx.runAction(
        (internal as any).paymentsV2Actions.ensureAirwallexFundSplitForPaymentOrderV2,
        {
          paymentOrderId: processingSummary.paymentOrderId,
        },
      );
    }
    await ctx.runMutation((api as any).webhooksAirwallex.finalizeAirwallexWebhookEvent, {
      providerEventId: eventId,
      processingState: "processed",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Airwallex webhook error";
    await ctx.runMutation((api as any).webhooksAirwallex.finalizeAirwallexWebhookEvent, {
      providerEventId: eventId,
      processingState: "failed",
      processingError: message,
    });
    throw error;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
