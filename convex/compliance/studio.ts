import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireStudioOwnerContext } from "../lib/studioBranches";
import {
  buildStudioComplianceSummary,
  getStudioBillingProfile,
  getStudioPaymentProfile,
  studioBillingProfileStatusValidator,
  studioComplianceSummaryValidator,
  studioLegalEntityTypeValidator,
  studioPaymentStatusValidator,
  studioTaxClassificationValidator,
  studioVatReportingTypeValidator,
} from "../lib/studioCompliance";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
} from "../lib/validation";

const MAX_LEGAL_NAME_LENGTH = 160;
const MAX_TAX_ID_LENGTH = 40;
const MAX_BILLING_EMAIL_LENGTH = 160;
const MAX_BILLING_PHONE_LENGTH = 32;
const MAX_BILLING_ADDRESS_LENGTH = 220;

export const studioComplianceDetailsValidator = v.object({
  summary: studioComplianceSummaryValidator,
  billingProfile: v.union(
    v.null(),
    v.object({
      legalEntityType: studioLegalEntityTypeValidator,
      status: studioBillingProfileStatusValidator,
      legalBusinessName: v.optional(v.string()),
      taxId: v.optional(v.string()),
      vatReportingType: v.optional(studioVatReportingTypeValidator),
      taxClassification: v.optional(v.string()),
      country: v.optional(v.string()),
      companyRegNumber: v.optional(v.string()),
      legalForm: v.optional(v.string()),
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
      completedAt: v.optional(v.number()),
    }),
  ),
  paymentProfile: v.union(
    v.null(),
    v.object({
      provider: v.string(),
      status: studioPaymentStatusValidator,
      providerCustomerId: v.optional(v.string()),
      providerMerchantId: v.optional(v.string()),
      providerReference: v.optional(v.string()),
      displayName: v.optional(v.string()),
      requirementsSummary: v.optional(v.string()),
      chargesEnabled: v.optional(v.boolean()),
      payoutsEnabled: v.optional(v.boolean()),
      readyForChargesAt: v.optional(v.number()),
      readyForPayoutsAt: v.optional(v.number()),
      lastSyncedAt: v.optional(v.number()),
    }),
  ),
});

function normalizeEmail(value: string) {
  const normalized = normalizeRequiredString(
    value,
    MAX_BILLING_EMAIL_LENGTH,
    "Billing email",
  );
  if (!normalized.includes("@")) {
    throw new ConvexError("Billing email must be valid");
  }
  return normalized.toLowerCase();
}

export const getMyStudioComplianceSummary = query({
  args: {},
  returns: v.union(v.null(), studioComplianceSummaryValidator),
  handler: async (ctx) => {
    const { studio } = await requireStudioOwnerContext(ctx);
    return await buildStudioComplianceSummary(ctx, { studio });
  },
});

export async function getStudioComplianceDetailsRead(
  ctx: QueryCtx,
  args: {
    studioId: Doc<"studioProfiles">["_id"];
  },
) {
  const studio = await ctx.db.get(args.studioId);
  if (!studio) {
    return null;
  }

  const [summary, billingProfile, paymentProfile] = await Promise.all([
    buildStudioComplianceSummary(ctx, { studio }),
    getStudioBillingProfile(ctx, studio._id),
    getStudioPaymentProfile(ctx, studio._id),
  ]);

  return {
    summary,
    billingProfile: billingProfile
      ? {
          legalEntityType: billingProfile.legalEntityType,
          status: billingProfile.status,
          ...omitUndefined({
            legalBusinessName: billingProfile.legalBusinessName,
            taxId: billingProfile.taxId,
            vatReportingType: billingProfile.vatReportingType,
            taxClassification: billingProfile.taxClassification,
            country: billingProfile.country,
            companyRegNumber: billingProfile.companyRegNumber,
            legalForm: billingProfile.legalForm,
            billingEmail: billingProfile.billingEmail,
            billingPhone: billingProfile.billingPhone,
            billingAddress: billingProfile.billingAddress,
            billingAddressStructured: billingProfile.billingAddressStructured,
            completedAt: billingProfile.completedAt,
          }),
        }
      : null,
    paymentProfile: paymentProfile
      ? {
          provider: paymentProfile.provider,
          status: paymentProfile.status,
          ...omitUndefined({
            providerCustomerId: paymentProfile.providerCustomerId,
            providerMerchantId: paymentProfile.providerMerchantId,
            providerReference: paymentProfile.providerReference,
            displayName: paymentProfile.displayName,
            requirementsSummary: paymentProfile.requirementsSummary,
            chargesEnabled: paymentProfile.chargesEnabled,
            payoutsEnabled: paymentProfile.payoutsEnabled,
            readyForChargesAt: paymentProfile.readyForChargesAt,
            readyForPayoutsAt: paymentProfile.readyForPayoutsAt,
            lastSyncedAt: paymentProfile.lastSyncedAt,
          }),
        }
      : null,
  };
}

export const getMyStudioComplianceDetails = query({
  args: {},
  returns: v.union(v.null(), studioComplianceDetailsValidator),
  handler: async (ctx) => {
    const { studio } = await requireStudioOwnerContext(ctx);
    return await getStudioComplianceDetailsRead(ctx, { studioId: studio._id });
  },
});

export const upsertMyStudioBillingProfile = mutation({
  args: {
    country: v.optional(v.string()),
    legalEntityType: studioLegalEntityTypeValidator,
    legalBusinessName: v.string(),
    taxId: v.string(),
    taxClassification: v.optional(studioTaxClassificationValidator),
    companyRegNumber: v.optional(v.string()),
    legalForm: v.optional(v.string()),
    billingEmail: v.string(),
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
    ok: v.boolean(),
    status: studioBillingProfileStatusValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, studio } = await requireStudioOwnerContext(ctx);

    const legalBusinessName = normalizeRequiredString(
      args.legalBusinessName,
      MAX_LEGAL_NAME_LENGTH,
      "Legal business name",
    );
    const taxId = normalizeRequiredString(
      args.taxId,
      MAX_TAX_ID_LENGTH,
      "Tax ID",
    );
    const billingEmail = normalizeEmail(args.billingEmail);
    const billingPhone = normalizeOptionalString(
      args.billingPhone,
      MAX_BILLING_PHONE_LENGTH,
      "Billing phone",
    );
    const billingAddress = normalizeOptionalString(
      args.billingAddress,
      MAX_BILLING_ADDRESS_LENGTH,
      "Billing address",
    );
    const companyRegNumber = normalizeOptionalString(
      args.companyRegNumber,
      40,
      "Company registration number",
    );
    const country = args.country?.trim() || undefined;

    // Status is "complete" only when all required fields are present
    const hasRequiredFields =
      legalBusinessName.length > 0 &&
      taxId.length > 0 &&
      billingEmail.length > 0;
    const status = hasRequiredFields ? ("complete" as const) : ("incomplete" as const);

    const existing = await getStudioBillingProfile(ctx, studio._id);

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...omitUndefined({ country }),
        legalEntityType: args.legalEntityType,
        legalBusinessName,
        taxId,
        billingEmail,
        status,
        updatedAt: now,
        ...(status === "complete" ? { completedAt: now } : {}),
        ...omitUndefined({
          taxClassification: args.taxClassification,
          companyRegNumber,
          legalForm: args.legalForm,
          billingPhone,
          billingAddress,
          billingAddressStructured: args.billingAddressStructured,
        }),
      });
    } else {
      await ctx.db.insert("studioBillingProfiles", {
        studioId: studio._id,
        ownerUserId: user._id,
        ...omitUndefined({ country }),
        legalEntityType: args.legalEntityType,
        legalBusinessName,
        taxId,
        billingEmail,
        status,
        ...(status === "complete" ? { completedAt: now } : {}),
        createdAt: now,
        updatedAt: now,
        ...omitUndefined({
          taxClassification: args.taxClassification,
          companyRegNumber,
          legalForm: args.legalForm,
          billingPhone,
          billingAddress,
          billingAddressStructured: args.billingAddressStructured,
        }),
      });
    }

    return {
      ok: true,
      status,
    };
  },
});

export const applyStudioPaymentProfileSnapshot = internalMutation({
  args: {
    studioId: v.id("studioProfiles"),
    provider: v.string(),
    status: studioPaymentStatusValidator,
    providerCustomerId: v.optional(v.string()),
    providerMerchantId: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    displayName: v.optional(v.string()),
    requirementsSummary: v.optional(v.string()),
    chargesEnabled: v.optional(v.boolean()),
    payoutsEnabled: v.optional(v.boolean()),
    readyForChargesAt: v.optional(v.number()),
    readyForPayoutsAt: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    status: studioPaymentStatusValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getStudioPaymentProfile(ctx, args.studioId);

    const snapshot = {
      provider: args.provider.trim(),
      status: args.status,
      updatedAt: now,
      ...omitUndefined({
        providerCustomerId: args.providerCustomerId?.trim(),
        providerMerchantId: args.providerMerchantId?.trim(),
        providerReference: args.providerReference?.trim(),
        displayName: args.displayName?.trim(),
        requirementsSummary: args.requirementsSummary?.trim(),
        chargesEnabled: args.chargesEnabled,
        payoutsEnabled: args.payoutsEnabled,
        readyForChargesAt: args.readyForChargesAt,
        readyForPayoutsAt: args.readyForPayoutsAt,
        lastSyncedAt: args.lastSyncedAt ?? now,
      }),
    };

    if (existing) {
      await ctx.db.patch(existing._id, snapshot);
    } else {
      await ctx.db.insert("studioPaymentProfiles", {
        studioId: args.studioId,
        createdAt: now,
        ...snapshot,
      });
    }

    return {
      ok: true,
      status: args.status,
    };
  },
});
