import { getStripeMarketDefaults } from "@/lib/stripe";

export interface VatClassification {
  value: string;
  labelKey: string;
}

export interface LegalFormOption {
  value: string;
  labelKey: string;
}

export interface CountryFieldConfig {
  countryCode: string;
  taxIdLabelKey: string;
  taxIdPlaceholderKey?: string;
  vatClassifications: VatClassification[];
  showCompanyRegNumber: boolean;
  companyRegLabelKey?: string;
  showLegalForm: boolean;
  legalFormOptions?: LegalFormOption[];
  showBeneficialOwners: boolean;
}

function createGenericEuCountryConfig(countryCode: string): CountryFieldConfig {
  return {
    countryCode,
    taxIdLabelKey: "profile.studioCompliance.billing.taxId",
    vatClassifications: [],
    showCompanyRegNumber: true,
    companyRegLabelKey: "profile.studioCompliance.billing.companyReg",
    showLegalForm: false,
    showBeneficialOwners: true,
  };
}

export const COUNTRY_CONFIGS: Record<string, CountryFieldConfig> = {
  IL: {
    countryCode: "IL",
    taxIdLabelKey: "profile.studioCompliance.billing.taxId",
    taxIdPlaceholderKey: "profile.studioCompliance.billing.taxIdPlaceholderIL",
    vatClassifications: [
      { value: "osek_patur", labelKey: "profile.studioCompliance.billing.vatOptions.osek_patur" },
      { value: "osek_murshe", labelKey: "profile.studioCompliance.billing.vatOptions.osek_murshe" },
    ],
    showCompanyRegNumber: false,
    showLegalForm: false,
    showBeneficialOwners: false,
  },
  UK: {
    countryCode: "UK",
    taxIdLabelKey: "profile.studioCompliance.billing.taxId",
    vatClassifications: [],
    showCompanyRegNumber: true,
    companyRegLabelKey: "profile.studioCompliance.billing.companyReg",
    showLegalForm: false,
    showBeneficialOwners: true,
  },
  DE: {
    countryCode: "DE",
    taxIdLabelKey: "profile.studioCompliance.billing.taxIdDE",
    taxIdPlaceholderKey: "profile.studioCompliance.billing.taxIdPlaceholderDE",
    vatClassifications: [
      {
        value: "kleinunternehmer",
        labelKey: "profile.studioCompliance.billing.vatOptionsDE.kleinunternehmer",
      },
      {
        value: "regelbesteuerung",
        labelKey: "profile.studioCompliance.billing.vatOptionsDE.regelbesteuerung",
      },
    ],
    showCompanyRegNumber: true,
    companyRegLabelKey: "profile.studioCompliance.billing.companyRegDE",
    showLegalForm: true,
    legalFormOptions: [
      { value: "gmbh", labelKey: "profile.studioCompliance.billing.legalFormDE.gmbh" },
      { value: "ug", labelKey: "profile.studioCompliance.billing.legalFormDE.ug" },
      { value: "gbr", labelKey: "profile.studioCompliance.billing.legalFormDE.gbr" },
      { value: "ohg", labelKey: "profile.studioCompliance.billing.legalFormDE.ohg" },
      { value: "kg", labelKey: "profile.studioCompliance.billing.legalFormDE.kg" },
      { value: "eg", labelKey: "profile.studioCompliance.billing.legalFormDE.eg" },
      { value: "ev", labelKey: "profile.studioCompliance.billing.legalFormDE.ev" },
      { value: "sole", labelKey: "profile.studioCompliance.billing.legalFormDE.sole" },
    ],
    showBeneficialOwners: true,
  },
  FR: {
    countryCode: "FR",
    taxIdLabelKey: "profile.studioCompliance.billing.taxIdFR",
    taxIdPlaceholderKey: "profile.studioCompliance.billing.taxIdPlaceholderFR",
    vatClassifications: [
      {
        value: "franchise_tva",
        labelKey: "profile.studioCompliance.billing.vatOptionsFR.franchise",
      },
      {
        value: "assujetti_tva",
        labelKey: "profile.studioCompliance.billing.vatOptionsFR.assujetti",
      },
    ],
    showCompanyRegNumber: true,
    companyRegLabelKey: "profile.studioCompliance.billing.companyRegFR",
    showLegalForm: true,
    legalFormOptions: [
      { value: "sarL", labelKey: "profile.studioCompliance.billing.legalFormFR.sarl" },
      { value: "sa", labelKey: "profile.studioCompliance.billing.legalFormFR.sa" },
      { value: "sas", labelKey: "profile.studioCompliance.billing.legalFormFR.sas" },
      { value: "eurl", labelKey: "profile.studioCompliance.billing.legalFormFR.eurl" },
      {
        value: "auto_entrepreneur",
        labelKey: "profile.studioCompliance.billing.legalFormFR.autoEntrepreneur",
      },
    ],
    showBeneficialOwners: true,
  },
  ES: {
    countryCode: "ES",
    taxIdLabelKey: "profile.studioCompliance.billing.taxIdES",
    taxIdPlaceholderKey: "profile.studioCompliance.billing.taxIdPlaceholderES",
    vatClassifications: [
      {
        value: "regimen_simplificado",
        labelKey: "profile.studioCompliance.billing.vatOptionsES.simplificado",
      },
      {
        value: "regimen_general",
        labelKey: "profile.studioCompliance.billing.vatOptionsES.general",
      },
    ],
    showCompanyRegNumber: true,
    companyRegLabelKey: "profile.studioCompliance.billing.companyRegES",
    showLegalForm: true,
    legalFormOptions: [
      { value: "sl", labelKey: "profile.studioCompliance.billing.legalFormES.sl" },
      { value: "sa", labelKey: "profile.studioCompliance.billing.legalFormES.sa" },
      { value: "sc", labelKey: "profile.studioCompliance.billing.legalFormES.sc" },
      { value: "autonomo", labelKey: "profile.studioCompliance.billing.legalFormES.autonomo" },
    ],
    showBeneficialOwners: true,
  },
  IT: createGenericEuCountryConfig("IT"),
  NL: createGenericEuCountryConfig("NL"),
  PT: createGenericEuCountryConfig("PT"),
  IE: createGenericEuCountryConfig("IE"),
  BE: createGenericEuCountryConfig("BE"),
  AT: createGenericEuCountryConfig("AT"),
};

export function getCountryConfig(country: string): CountryFieldConfig {
  const normalizedCountry =
    country.trim().toUpperCase() === "GB" ? "UK" : country.trim().toUpperCase();
  return (
    COUNTRY_CONFIGS[normalizedCountry] ??
    COUNTRY_CONFIGS[
      getStripeMarketDefaults().country === "GB" ? "UK" : getStripeMarketDefaults().country
    ] ??
    COUNTRY_CONFIGS.DE!
  );
}

export function isEUCountry(country: string): boolean {
  return ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE"].includes(country);
}
