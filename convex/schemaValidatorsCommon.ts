import { v } from "convex/values";

export const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});

export const diditCanonicalPayloadValidator = v.any();
export const airwallexCanonicalPayloadValidator = v.any();

export const storedSpecialtyValidator = v.object({
  sport: v.string(),
  capabilityTags: v.optional(v.array(v.string())),
});

export const integrationMetadataValidator = v.object({
  providerPaymentId: v.optional(v.string()),
  providerCheckoutId: v.optional(v.string()),
  merchantReferenceId: v.optional(v.string()),
  statusRaw: v.optional(v.string()),
  providerPayoutId: v.optional(v.string()),
  providerAccountId: v.optional(v.string()),
  providerFundsSplitId: v.optional(v.string()),
  payoutId: v.optional(v.string()),
  beneficiaryId: v.optional(v.string()),
  payoutMethodType: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  vendorData: v.optional(v.string()),
  decisionJson: v.optional(v.string()),
});
