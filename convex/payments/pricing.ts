import { ConvexError } from "convex/values";

export const PRICING_RULE_VERSION_V1 = "il_v1_2026_04_07";
export const PLATFORM_SERVICE_FEE_STANDARD_AGOROT = 1200;
export const PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT = 1500;
export const PLATFORM_SERVICE_FEE_STANDARD_MAJOR = 4;
export const PLATFORM_SERVICE_FEE_WITH_BONUS_MAJOR = 5;

export type PricingFeeMode = "standard" | "bonus";

export type PricingInput = {
  baseLessonAmountAgorot: number;
  bonusAmountAgorot?: number;
  country?: string;
  currency?: string;
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

type PricingRule = {
  code: string;
  country?: string;
  currency: string;
  basePlatformFeeAgorot: number;
  bonusPlatformFeeAgorot: number;
  version: string;
};

const PRICING_RULES: PricingRule[] = [
  {
    code: "market_usd",
    country: "US",
    currency: "USD",
    basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_MAJOR * 100,
    bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_MAJOR * 100,
    version: "usd_v1_2026_04_10",
  },
  {
    code: "market_eur",
    currency: "EUR",
    basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_MAJOR * 100,
    bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_MAJOR * 100,
    version: "eur_v1_2026_04_10",
  },
  {
    code: "market_gbp",
    country: "GB",
    currency: "GBP",
    basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_MAJOR * 100,
    bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_MAJOR * 100,
    version: "gbp_v1_2026_04_10",
  },
];

const normalizeCode = (value: string | undefined) => value?.trim().toUpperCase() ?? "";

function resolvePricingRule(input: PricingInput): PricingRule {
  const country = normalizeCode(input.country);
  const currency = normalizeCode(input.currency);

  const countryRule = PRICING_RULES.find(
    (rule) => rule.country && rule.country === country && rule.currency === currency,
  );
  if (countryRule) {
    return countryRule;
  }

  const currencyRule = PRICING_RULES.find((rule) => rule.currency === currency);
  if (currencyRule) {
    return currencyRule;
  }

  return {
    code: "market_ils",
    country: "IL",
    currency: "ILS",
    basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_AGOROT,
    bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT,
    version: PRICING_RULE_VERSION_V1,
  };
}

export const computePricing = (input: PricingInput): PricingBreakdown => {
  const baseLessonAmountAgorot = requirePositiveAgorot(
    input.baseLessonAmountAgorot,
    "baseLessonAmountAgorot",
  );
  const bonusAmountAgorot = requireNonNegativeAgorot(
    input.bonusAmountAgorot ?? 0,
    "bonusAmountAgorot",
  );
  const hasBonus = bonusAmountAgorot > 0;
  const rule = resolvePricingRule(input);
  const platformServiceFeeAgorot = hasBonus
    ? rule.bonusPlatformFeeAgorot
    : rule.basePlatformFeeAgorot;
  const instructorOfferAmountAgorot = baseLessonAmountAgorot + bonusAmountAgorot;
  const studioChargeAmountAgorot = instructorOfferAmountAgorot + platformServiceFeeAgorot;

  return {
    baseLessonAmountAgorot,
    bonusAmountAgorot,
    instructorOfferAmountAgorot,
    platformServiceFeeAgorot,
    studioChargeAmountAgorot,
    pricingRuleVersion: rule.version,
    feeMode: hasBonus ? "bonus" : "standard",
    hasBonus,
  };
};

export const pricingRuleRecord = {
  code: "default_il_marketplace",
  country: "IL",
  currency: "ILS",
  basePlatformFeeAgorot: PLATFORM_SERVICE_FEE_STANDARD_AGOROT,
  bonusPlatformFeeAgorot: PLATFORM_SERVICE_FEE_WITH_BONUS_AGOROT,
  bonusTriggerMode: "bonus_amount_positive" as const,
  active: true,
  version: PRICING_RULE_VERSION_V1,
};
