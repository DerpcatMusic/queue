import { getStripeMarketDefaults } from "../integrations/stripe/config";

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export type MarketRules = {
  country: string;
  requiresStudioDiditVerification: boolean;
  requiresInstructorInsurance: boolean;
};

export function isEUCountry(country: string | undefined) {
  return country !== undefined && EU_COUNTRIES.has(country.trim().toUpperCase());
}

export function getMarketRules(country?: string | null): MarketRules {
  const resolvedCountry = (
    country?.trim().toUpperCase() || getStripeMarketDefaults().country
  ).toUpperCase();
  return {
    country: resolvedCountry,
    requiresStudioDiditVerification: true,
    requiresInstructorInsurance: isEUCountry(resolvedCountry),
  };
}
