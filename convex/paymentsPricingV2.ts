import { ConvexError } from "convex/values";

export const PRICING_RULE_VERSION_V1 = "il_v1_2026_04_07";
export const PLATFORM_SERVICE_FEE_STANDARD_AGOROT = 1200;
export const PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT = 1500;

export type PricingFeeMode = "standard" | "bonus";

export type PricingInput = {
  baseLessonAmountAgorot: number;
  bonusAmountAgorot?: number;
};

export type PricingBreakdown = {
  baseLessonAmountAgorot: number;
  bonusAmountAgorot: number;
  instructorOfferAmountAgorot: number;
  platformServiceFeeAgorot: number;
  studioChargeAmountAgorot: number;
  pricingRuleVersion: string;
  feeMode: PricingFeeMode;
  hasBonus: boolean;
};

const requireNonNegativeAgorot = (amountAgorot: number, label: string): number => {
  if (!Number.isFinite(amountAgorot) || amountAgorot < 0) {
    throw new ConvexError(`${label} must be a non-negative integer agorot amount`);
  }
  return Math.round(amountAgorot);
};

const requirePositiveAgorot = (amountAgorot: number, label: string): number => {
  if (!Number.isFinite(amountAgorot) || amountAgorot <= 0) {
    throw new ConvexError(`${label} must be a positive integer agorot amount`);
  }
  return Math.round(amountAgorot);
};

export const computePricingV2 = (input: PricingInput): PricingBreakdown => {
  const baseLessonAmountAgorot = requirePositiveAgorot(
    input.baseLessonAmountAgorot,
    "baseLessonAmountAgorot",
  );
  const bonusAmountAgorot = requireNonNegativeAgorot(input.bonusAmountAgorot ?? 0, "bonusAmountAgorot");
  const hasBonus = bonusAmountAgorot > 0;
  const platformServiceFeeAgorot = hasBonus
    ? PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT
    : PLATFORM_SERVICE_FEE_STANDARD_AGOROT;
  const instructorOfferAmountAgorot = baseLessonAmountAgorot + bonusAmountAgorot;
  const studioChargeAmountAgorot = instructorOfferAmountAgorot + platformServiceFeeAgorot;

  return {
    baseLessonAmountAgorot,
    bonusAmountAgorot,
    instructorOfferAmountAgorot,
    platformServiceFeeAgorot,
    studioChargeAmountAgorot,
    pricingRuleVersion: PRICING_RULE_VERSION_V1,
    feeMode: hasBonus ? "bonus" : "standard",
    hasBonus,
  };
};

export const pricingRuleRecordV2 = {
  code: "default_il_marketplace",
  country: "IL",
  currency: "ILS",
  basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_AGOROT,
  bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT,
  bonusTriggerMode: "bonus_amount_positive" as const,
  active: true,
  version: PRICING_RULE_VERSION_V1,
};
