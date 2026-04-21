import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { getStudioBillingProfile } from "../lib/studioCompliance";
import { mirrorConnectedAccount } from "./neutralMirror";
import {
  mapStripeIdentitySessionStatusToLegacyIdentityStatus,
  mapStripeProviderStatusToCanonical,
  mapStripeStatusToLegacyIdentityStatus,
} from "./projectors";

export const syncStripeConnectedAccountWebhook = internalMutation({
  args: {
    providerAccountId: v.string(),
    providerStatusRaw: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", "stripe").eq("providerAccountId", args.providerAccountId),
      )
      .unique();

    if (!existing) {
      return null;
    }

    const mappedStatus = mapStripeProviderStatusToCanonical(args.providerStatusRaw);
    await ctx.db.patch(existing._id, {
      status: mappedStatus,
      kycStatus: args.providerStatusRaw,
      metadata: {
        ...(existing.metadata ?? {}),
        providerStatusRaw: args.providerStatusRaw,
        ...(args.metadata ?? {}),
      },
      country: args.country ?? existing.country,
      currency: args.currency ?? existing.currency,
      updatedAt: now,
      activatedAt: mappedStatus === "active" ? (existing.activatedAt ?? now) : existing.activatedAt,
    });
    const updated = await ctx.db.get(existing._id);
    if (updated) {
      await mirrorConnectedAccount(ctx, updated);
    }

    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", existing.userId))
      .unique();
    if (instructorProfile) {
      await ctx.db.patch(instructorProfile._id, {
        diditSessionId: args.providerAccountId,
        diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
        diditStatusRaw: args.providerStatusRaw,
        diditLastEventAt: now,
        ...(mappedStatus === "active"
          ? { diditVerifiedAt: instructorProfile.diditVerifiedAt ?? now }
          : {}),
        ...(args.legalName ? { diditLegalName: args.legalName } : {}),
        ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
        ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
        ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
        updatedAt: now,
      });
    }

    return null;
  },
});

export const syncStudioDiditVerification = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    statusRaw: v.string(),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    country: v.optional(v.string()),
    billingBusinessName: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    billingPhone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    billingAddressStructured: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.optional(v.string()),
        postalCode: v.string(),
        country: v.optional(v.string()),
      }),
    ),
    decision: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const studioProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!studioProfile) {
      return null;
    }

    const mappedStatus =
      mapStripeIdentitySessionStatusToLegacyIdentityStatus(args.statusRaw) ?? "not_started";
    const existingBillingProfile = await getStudioBillingProfile(ctx, studioProfile._id);

    const billingPatch = {
      ...(!existingBillingProfile?.legalBusinessName?.trim() && args.billingBusinessName
        ? { legalBusinessName: args.billingBusinessName.trim() }
        : {}),
      ...(!existingBillingProfile?.billingEmail?.trim() && args.billingEmail
        ? { billingEmail: args.billingEmail.trim() }
        : {}),
      ...(!existingBillingProfile?.billingPhone?.trim() && args.billingPhone
        ? { billingPhone: args.billingPhone.trim() }
        : {}),
      ...(!existingBillingProfile?.billingAddress?.trim() && args.billingAddress
        ? { billingAddress: args.billingAddress.trim() }
        : {}),
      ...(!existingBillingProfile?.billingAddressStructured && args.billingAddressStructured
        ? { billingAddressStructured: args.billingAddressStructured }
        : {}),
      ...(!existingBillingProfile?.country?.trim() && args.country
        ? { country: args.country.trim() }
        : {}),
    } as Record<string, unknown>;

    await ctx.db.patch(studioProfile._id, {
      diditSessionId: args.sessionId,
      diditVerificationStatus: mappedStatus,
      diditStatusRaw: args.statusRaw,
      diditLastEventAt: now,
      ...(mappedStatus === "approved"
        ? { diditVerifiedAt: studioProfile.diditVerifiedAt ?? now }
        : {}),
      ...(args.legalName ? { diditLegalName: args.legalName } : {}),
      ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
      ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
      ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
      ...(args.decision !== undefined ? { diditDecision: args.decision } : {}),
      updatedAt: now,
    });

    if (existingBillingProfile) {
      if (Object.keys(billingPatch).length > 0) {
        await ctx.db.patch(existingBillingProfile._id, {
          ...billingPatch,
          updatedAt: now,
        });
      }
    } else if (
      Object.keys(billingPatch).length > 0 ||
      args.billingBusinessName ||
      args.billingEmail
    ) {
      await ctx.db.insert("studioBillingProfiles", {
        studioId: studioProfile._id,
        ownerUserId: studioProfile.userId,
        legalEntityType: "individual",
        legalBusinessName: args.billingBusinessName?.trim() ?? "",
        taxId: "",
        billingEmail: args.billingEmail?.trim() ?? "",
        status: "incomplete",
        createdAt: now,
        updatedAt: now,
        ...("country" in billingPatch ? { country: args.country?.trim() } : {}),
        ...("billingPhone" in billingPatch ? { billingPhone: args.billingPhone?.trim() } : {}),
        ...("billingAddress" in billingPatch
          ? { billingAddress: args.billingAddress?.trim() }
          : {}),
        ...("billingAddressStructured" in billingPatch
          ? { billingAddressStructured: args.billingAddressStructured }
          : {}),
      });
    }

    return null;
  },
});

export const applyDiditStudioWebhook = internalMutation({
  args: {
    providerEventId: v.string(),
    sessionId: v.string(),
    statusRaw: v.string(),
    vendorData: v.optional(v.string()),
    webhookType: v.optional(v.string()),
    payload: v.any(),
    payloadHash: v.string(),
    signatureValid: v.boolean(),
    decision: v.optional(v.any()),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    country: v.optional(v.string()),
    billingBusinessName: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    billingPhone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    billingAddressStructured: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.optional(v.string()),
        postalCode: v.string(),
        country: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    inserted: v.boolean(),
    sessionId: v.string(),
    mappedStatus: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("pending"),
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("abandoned"),
      v.literal("expired"),
    ),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("diditEvents")
      .withIndex("by_provider_event_id", (q) => q.eq("providerEventId", args.providerEventId))
      .unique();

    const mappedStatus =
      mapStripeIdentitySessionStatusToLegacyIdentityStatus(args.statusRaw) ?? "not_started";
    const record = {
      providerEventId: args.providerEventId,
      sessionId: args.sessionId,
      statusRaw: args.statusRaw,
      mappedStatus,
      signatureValid: args.signatureValid,
      processed: false,
      payloadHash: args.payloadHash,
      payload: args.payload,
      createdAt: now,
      updatedAt: now,
      ...(args.vendorData ? { vendorData: args.vendorData } : {}),
    };

    const needsProcessing = !existing?.processed;
    if (existing) {
      if (existing.processed) {
        return {
          inserted: false,
          sessionId: args.sessionId,
          mappedStatus,
        };
      }
      await ctx.db.patch(existing._id, {
        sessionId: args.sessionId,
        statusRaw: args.statusRaw,
        mappedStatus,
        signatureValid: args.signatureValid,
        payload: args.payload,
        payloadHash: args.payloadHash,
        ...(args.vendorData ? { vendorData: args.vendorData } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("diditEvents", record as any);
    }

    if (needsProcessing) {
      const userId = args.vendorData?.trim();
      const user = userId && userId.length > 0 ? await ctx.db.get("users", userId as any) : null;
      const studioProfile =
        user?.role === "studio"
          ? await ctx.db
              .query("studioProfiles")
              .withIndex("by_user_id", (q) => q.eq("userId", user._id))
              .unique()
          : null;

      if (studioProfile) {
        const existingBillingProfile = await getStudioBillingProfile(ctx, studioProfile._id);
        const billingPatch = {
          ...(!existingBillingProfile?.legalBusinessName?.trim() && args.billingBusinessName
            ? { legalBusinessName: args.billingBusinessName.trim() }
            : {}),
          ...(!existingBillingProfile?.billingEmail?.trim() && args.billingEmail
            ? { billingEmail: args.billingEmail.trim() }
            : {}),
          ...(!existingBillingProfile?.billingPhone?.trim() && args.billingPhone
            ? { billingPhone: args.billingPhone.trim() }
            : {}),
          ...(!existingBillingProfile?.billingAddress?.trim() && args.billingAddress
            ? { billingAddress: args.billingAddress.trim() }
            : {}),
          ...(!existingBillingProfile?.billingAddressStructured && args.billingAddressStructured
            ? { billingAddressStructured: args.billingAddressStructured }
            : {}),
          ...(!existingBillingProfile?.country?.trim() && args.country
            ? { country: args.country.trim() }
            : {}),
        } as Record<string, unknown>;

        await ctx.db.patch(studioProfile._id, {
          diditSessionId: args.sessionId,
          diditVerificationStatus: mappedStatus,
          diditStatusRaw: args.statusRaw,
          diditLastEventAt: now,
          ...(mappedStatus === "approved"
            ? { diditVerifiedAt: studioProfile.diditVerifiedAt ?? now }
            : {}),
          ...(args.legalName ? { diditLegalName: args.legalName } : {}),
          ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
          ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
          ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
          ...(args.decision !== undefined ? { diditDecision: args.decision } : {}),
          updatedAt: now,
        });

        if (existingBillingProfile) {
          if (Object.keys(billingPatch).length > 0) {
            await ctx.db.patch(existingBillingProfile._id, {
              ...billingPatch,
              updatedAt: now,
            });
          }
        } else if (
          Object.keys(billingPatch).length > 0 ||
          args.billingBusinessName ||
          args.billingEmail
        ) {
          await ctx.db.insert("studioBillingProfiles", {
            studioId: studioProfile._id,
            ownerUserId: studioProfile.userId,
            legalEntityType: "individual",
            legalBusinessName: args.billingBusinessName?.trim() ?? "",
            taxId: "",
            billingEmail: args.billingEmail?.trim() ?? "",
            status: "incomplete",
            createdAt: now,
            updatedAt: now,
            ...("country" in billingPatch ? { country: args.country?.trim() } : {}),
            ...("billingPhone" in billingPatch ? { billingPhone: args.billingPhone?.trim() } : {}),
            ...("billingAddress" in billingPatch
              ? { billingAddress: args.billingAddress?.trim() }
              : {}),
            ...("billingAddressStructured" in billingPatch
              ? { billingAddressStructured: args.billingAddressStructured }
              : {}),
          });
        }
      }

      const event = existing
        ? existing
        : await ctx.db
            .query("diditEvents")
            .withIndex("by_provider_event_id", (q) => q.eq("providerEventId", args.providerEventId))
            .unique();
      if (event) {
        await ctx.db.patch(event._id, {
          processed: true,
          updatedAt: now,
        });
      }
    }

    return {
      inserted: !existing,
      sessionId: args.sessionId,
      mappedStatus,
    };
  },
});
