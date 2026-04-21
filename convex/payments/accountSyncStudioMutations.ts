import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import { mirrorConnectedAccount } from "./neutralMirror";
import {
  mapAirwallexAccountStatusToCanonical,
  mapStripeProviderStatusToCanonical,
  mapStripeStatusToLegacyIdentityStatus,
  projectConnectedAccount,
} from "./projectors";
import {
  connectedAccountOnboardingSummaryValidator,
  DEFAULT_PROVIDER_COUNTRY,
  DEFAULT_PROVIDER_CURRENCY,
  paymentProviderValidator,
} from "./validators";

export const upsertStudioConnectedAccountFromProvider = internalMutation({
  args: {
    provider: paymentProviderValidator,
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
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["studio"]);

    const existing = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    const mappedStatus =
      args.provider === "stripe"
        ? mapStripeProviderStatusToCanonical(args.providerStatusRaw)
        : mapAirwallexAccountStatusToCanonical(args.providerStatusRaw);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        providerAccountId: args.providerAccountId,
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
        activatedAt:
          mappedStatus === "active" ? (existing.activatedAt ?? now) : existing.activatedAt,
      });

      const studioProfile = await ctx.db
        .query("studioProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();
      if (studioProfile && args.provider === "stripe") {
        await ctx.db.patch(studioProfile._id, {
          diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
          diditStatusRaw: args.providerStatusRaw,
          diditLastEventAt: now,
          ...(mappedStatus === "active"
            ? { diditVerifiedAt: studioProfile.diditVerifiedAt ?? now }
            : {}),
          ...(args.legalName ? { diditLegalName: args.legalName } : {}),
          updatedAt: now,
        });
      }

      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update studio connected account");
      }
      await mirrorConnectedAccount(ctx, updated);
      return projectConnectedAccount(updated);
    }

    const accountId = await ctx.db.insert("connectedAccounts", {
      userId: user._id,
      role: "studio",
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      accountCapability: "withdrawal",
      status: mappedStatus,
      kycStatus: args.providerStatusRaw,
      country: args.country ?? DEFAULT_PROVIDER_COUNTRY,
      currency: args.currency ?? DEFAULT_PROVIDER_CURRENCY,
      metadata: {
        providerStatusRaw: args.providerStatusRaw,
        ...(args.metadata ?? {}),
      },
      createdAt: now,
      updatedAt: now,
      ...(mappedStatus === "active" ? { activatedAt: now } : {}),
    });

    const studioProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (studioProfile && args.provider === "stripe") {
      await ctx.db.patch(studioProfile._id, {
        diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
        diditStatusRaw: args.providerStatusRaw,
        diditLastEventAt: now,
        ...(mappedStatus === "active" ? { diditVerifiedAt: now } : {}),
        ...(args.legalName ? { diditLegalName: args.legalName } : {}),
        updatedAt: now,
      });
    }

    const account = await ctx.db.get("connectedAccounts", accountId);
    if (!account) {
      throw new ConvexError("Failed to create studio connected account");
    }
    await mirrorConnectedAccount(ctx, account);
    return projectConnectedAccount(account);
  },
});
