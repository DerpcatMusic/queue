"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { lookupPublicProfessionalRegistryRecord as lookupPublicProfessionalRegistryRecordCore } from "../lib/professionalRegistry";

const professionalRegistryQualificationValidator = v.object({
  title: v.string(),
  alert: v.optional(v.string()),
  conditions: v.optional(v.string()),
  obtainedOn: v.optional(v.string()),
  obtainedAt: v.optional(v.number()),
  validFromOn: v.optional(v.string()),
  validFromAt: v.optional(v.number()),
  validUntilOn: v.optional(v.string()),
  validUntilAt: v.optional(v.number()),
  lastReviewedOn: v.optional(v.string()),
  lastReviewedAt: v.optional(v.number()),
  renewalRequiredByOn: v.optional(v.string()),
  renewalRequiredByAt: v.optional(v.number()),
});

const publicProfessionalRegistryLookupResultValidator = v.object({
  country: v.literal("FR"),
  provider: v.literal("france_eaps_public"),
  status: v.union(v.literal("found"), v.literal("not_found")),
  queriedIdentifier: v.string(),
  normalizedIdentifier: v.string(),
  apiUrl: v.string(),
  publicProfileUrl: v.string(),
  checkedAt: v.number(),
  isPublic: v.boolean(),
  hasValidRegistration: v.boolean(),
  holder: v.optional(
    v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      fullName: v.string(),
    }),
  ),
  issuingAuthority: v.optional(v.string()),
  expiresOn: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  qualifications: v.array(professionalRegistryQualificationValidator),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  registryFlags: v.object({
    isStagiaire: v.boolean(),
    isLPS: v.boolean(),
    isTitulaireDiplome: v.boolean(),
    hasRecycleNotice: v.boolean(),
  }),
});

export const lookupPublicProfessionalRegistryRecord = action({
  args: {
    country: v.union(v.literal("FR")),
    identifier: v.string(),
  },
  returns: publicProfessionalRegistryLookupResultValidator,
  handler: async (_ctx, args) => {
    try {
      return await lookupPublicProfessionalRegistryRecordCore({
        country: args.country,
        identifier: args.identifier,
      });
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Professional registry lookup failed",
      );
    }
  },
});
