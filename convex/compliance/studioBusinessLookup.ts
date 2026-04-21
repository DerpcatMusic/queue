"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { lookupStudioBusinessIdentity } from "../lib/studioBusinessLookup";

const studioBusinessAddressValidator = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.optional(v.string()),
  postalCode: v.string(),
  country: v.optional(v.string()),
});

const studioBusinessLookupResultValidator = v.object({
  country: v.union(v.literal("FR"), v.literal("DE"), v.literal("UK"), v.literal("GB")),
  provider: v.union(v.literal("vies"), v.literal("companies_house"), v.literal("api_entreprise")),
  status: v.union(
    v.literal("found"),
    v.literal("partial"),
    v.literal("not_found"),
    v.literal("unsupported"),
    v.literal("unavailable"),
  ),
  queriedIdentifier: v.string(),
  normalizedIdentifier: v.string(),
  sourceUrl: v.string(),
  checkedAt: v.number(),
  legalBusinessName: v.optional(v.string()),
  taxId: v.optional(v.string()),
  companyRegNumber: v.optional(v.string()),
  legalForm: v.optional(v.string()),
  billingAddress: v.optional(v.string()),
  billingAddressStructured: v.optional(studioBusinessAddressValidator),
  message: v.optional(v.string()),
  notes: v.optional(v.array(v.string())),
});

export const lookupMyStudioBusinessIdentity = action({
  args: {
    country: v.union(v.literal("FR"), v.literal("DE"), v.literal("UK"), v.literal("GB")),
    legalBusinessName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    companyRegNumber: v.optional(v.string()),
  },
  returns: studioBusinessLookupResultValidator,
  handler: async (_ctx, args) => {
    try {
      const result = await lookupStudioBusinessIdentity({
        country: args.country === "GB" ? "UK" : args.country,
        legalBusinessName: args.legalBusinessName,
        taxId: args.taxId,
        companyRegNumber: args.companyRegNumber,
      });
      return result as any;
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Business registry lookup failed",
      );
    }
  },
});
