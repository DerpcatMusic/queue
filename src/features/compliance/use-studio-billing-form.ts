import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { getStripeMarketDefaults } from "@/lib/stripe";
import { type CountryFieldConfig, getCountryConfig } from "./country-field-config";

export interface BillingAddressStructured {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
}

export interface BillingProfileSnapshot {
  legalEntityType: "individual" | "company";
  status: "incomplete" | "complete";
  legalBusinessName?: string;
  taxId?: string;
  vatReportingType?: "osek_patur" | "osek_murshe" | "company" | "other";
  taxClassification?: string;
  country?: string;
  companyRegNumber?: string;
  legalForm?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  billingAddressStructured?: BillingAddressStructured;
  completedAt?: number;
}

export interface BillingFormFields {
  country: string;
  legalEntityType: "individual" | "company";
  legalBusinessName: string;
  taxId: string;
  taxClassification: string;
  companyRegNumber: string;
  legalForm: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: string;
  billingAddressStructured: BillingAddressStructured | null;
}

export type BillingFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

export function useStudioBillingForm(
  billingProfile: BillingProfileSnapshot | null | undefined,
  currentUserEmail?: string,
  currentUserPhone?: string,
  defaultBusinessName?: string,
  autoSave = true,
) {
  const saveBillingProfile = useMutation(api.complianceStudio.upsertMyStudioBillingProfile);

  const defaultCountry = getStripeMarketDefaults().country;
  const [country, setCountry] = useState(billingProfile?.country ?? defaultCountry);
  const [legalEntityType, setLegalEntityType] = useState<"individual" | "company">(
    billingProfile?.legalEntityType ?? "individual",
  );
  const [legalBusinessName, setLegalBusinessName] = useState(
    billingProfile?.legalBusinessName ?? defaultBusinessName ?? "",
  );
  const [taxId, setTaxId] = useState(billingProfile?.taxId ?? "");
  const [taxClassification, setTaxClassification] = useState(
    billingProfile?.taxClassification ?? billingProfile?.vatReportingType ?? "",
  );
  const [companyRegNumber, setCompanyRegNumber] = useState(billingProfile?.companyRegNumber ?? "");
  const [legalForm, setLegalForm] = useState(billingProfile?.legalForm ?? "");
  const [billingEmail, setBillingEmail] = useState(
    billingProfile?.billingEmail ?? currentUserEmail ?? "",
  );
  const [billingPhone, setBillingPhone] = useState(
    billingProfile?.billingPhone ?? currentUserPhone ?? "",
  );
  const [billingAddress, setBillingAddress] = useState(billingProfile?.billingAddress ?? "");
  const [billingAddressStructured, setBillingAddressStructured] =
    useState<BillingAddressStructured | null>(billingProfile?.billingAddressStructured ?? null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<BillingFeedback>(null);

  // Track original values for dirty detection
  const originalRef = useRef<BillingFormFields | null>(null);

  const countryConfig: CountryFieldConfig = getCountryConfig(country);

  // Hydrate from billing profile
  useEffect(() => {
    if (!billingProfile) {
      const fallbackFields = {
        country: defaultCountry,
        legalEntityType: "individual" as const,
        legalBusinessName: defaultBusinessName ?? "",
        taxId: "",
        taxClassification: "",
        companyRegNumber: "",
        legalForm: "",
        billingEmail: currentUserEmail ?? "",
        billingPhone: currentUserPhone ?? "",
        billingAddress: "",
        billingAddressStructured: null,
      } satisfies BillingFormFields;
      setCountry(fallbackFields.country);
      setLegalEntityType(fallbackFields.legalEntityType);
      setLegalBusinessName(fallbackFields.legalBusinessName);
      setTaxId(fallbackFields.taxId);
      setTaxClassification(fallbackFields.taxClassification);
      setCompanyRegNumber(fallbackFields.companyRegNumber);
      setLegalForm(fallbackFields.legalForm);
      setBillingEmail(fallbackFields.billingEmail);
      setBillingPhone(fallbackFields.billingPhone);
      setBillingAddress(fallbackFields.billingAddress);
      setBillingAddressStructured(fallbackFields.billingAddressStructured);
      originalRef.current = fallbackFields;
      return;
    }
    const hydratedFields = {
      country: billingProfile.country ?? defaultCountry,
      legalEntityType: billingProfile.legalEntityType,
      legalBusinessName: billingProfile.legalBusinessName ?? "",
      taxId: billingProfile.taxId ?? "",
      taxClassification: billingProfile.taxClassification ?? billingProfile.vatReportingType ?? "",
      companyRegNumber: billingProfile.companyRegNumber ?? "",
      legalForm: billingProfile.legalForm ?? "",
      billingEmail: billingProfile.billingEmail ?? currentUserEmail ?? "",
      billingPhone: billingProfile.billingPhone ?? currentUserPhone ?? "",
      billingAddress: billingProfile.billingAddress ?? "",
      billingAddressStructured: billingProfile.billingAddressStructured ?? null,
    } satisfies BillingFormFields;
    setCountry(hydratedFields.country);
    setLegalEntityType(hydratedFields.legalEntityType);
    setLegalBusinessName(hydratedFields.legalBusinessName);
    setTaxId(hydratedFields.taxId);
    setTaxClassification(hydratedFields.taxClassification);
    setCompanyRegNumber(hydratedFields.companyRegNumber);
    setLegalForm(hydratedFields.legalForm);
    setBillingEmail(hydratedFields.billingEmail);
    setBillingPhone(hydratedFields.billingPhone);
    setBillingAddress(hydratedFields.billingAddress);
    setBillingAddressStructured(hydratedFields.billingAddressStructured);
    originalRef.current = hydratedFields;
  }, [billingProfile, currentUserEmail, currentUserPhone, defaultBusinessName, defaultCountry]);

  const isDirty = useCallback(() => {
    const orig = originalRef.current;
    if (!orig) return false;
    return (
      orig.country !== country ||
      orig.legalEntityType !== legalEntityType ||
      orig.legalBusinessName !== legalBusinessName ||
      orig.taxId !== taxId ||
      orig.taxClassification !== taxClassification ||
      orig.companyRegNumber !== companyRegNumber ||
      orig.legalForm !== legalForm ||
      orig.billingEmail !== billingEmail ||
      orig.billingPhone !== billingPhone ||
      orig.billingAddress !== billingAddress ||
      JSON.stringify(orig.billingAddressStructured) !== JSON.stringify(billingAddressStructured)
    );
  }, [
    country,
    legalEntityType,
    legalBusinessName,
    taxId,
    taxClassification,
    companyRegNumber,
    legalForm,
    billingEmail,
    billingPhone,
    billingAddress,
    billingAddressStructured,
  ]);

  const save = useCallback(async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const result = await saveBillingProfile({
        country,
        legalEntityType,
        legalBusinessName,
        taxId,
        ...(taxClassification ? { taxClassification } : {}),
        ...(companyRegNumber.trim() ? { companyRegNumber } : {}),
        ...(legalForm ? { legalForm } : {}),
        billingEmail,
        ...(billingPhone.trim() ? { billingPhone } : {}),
        ...(billingAddress.trim() ? { billingAddress } : {}),
        ...(billingAddressStructured ? { billingAddressStructured } : {}),
      });
      setFeedback({ tone: "success", message: "Billing profile saved" });
      // Update original to prevent false dirty
      originalRef.current = {
        country,
        legalEntityType,
        legalBusinessName,
        taxId,
        taxClassification,
        companyRegNumber,
        legalForm,
        billingEmail,
        billingPhone,
        billingAddress,
        billingAddressStructured,
      };
      return result;
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save billing profile",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    saveBillingProfile,
    country,
    legalEntityType,
    legalBusinessName,
    taxId,
    taxClassification,
    companyRegNumber,
    legalForm,
    billingEmail,
    billingPhone,
    billingAddress,
    billingAddressStructured,
  ]);

  // Auto-save with debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback(() => {
    if (!autoSave) {
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isDirty()) {
        void save();
      }
    }, 600);
  }, [autoSave, isDirty, save]);

  const updateField = useCallback(
    <K extends keyof BillingFormFields>(key: K, value: BillingFormFields[K]) => {
      switch (key) {
        case "country":
          setCountry(value as string);
          break;
        case "legalEntityType":
          setLegalEntityType(value as "individual" | "company");
          break;
        case "legalBusinessName":
          setLegalBusinessName(value as string);
          break;
        case "taxId":
          setTaxId(value as string);
          break;
        case "taxClassification":
          setTaxClassification(value as string);
          break;
        case "companyRegNumber":
          setCompanyRegNumber(value as string);
          break;
        case "legalForm":
          setLegalForm(value as string);
          break;
        case "billingEmail":
          setBillingEmail(value as string);
          break;
        case "billingPhone":
          setBillingPhone(value as string);
          break;
        case "billingAddress":
          setBillingAddress(value as string);
          break;
        case "billingAddressStructured":
          setBillingAddressStructured(value as BillingAddressStructured | null);
          break;
      }
      debouncedSave();
    },
    [debouncedSave],
  );

  return {
    fields: {
      country,
      legalEntityType,
      legalBusinessName,
      taxId,
      taxClassification,
      companyRegNumber,
      legalForm,
      billingEmail,
      billingPhone,
      billingAddress,
      billingAddressStructured,
    } satisfies BillingFormFields,
    updateField,
    save,
    isSaving,
    feedback,
    isDirty,
    countryConfig,
    setCountry,
    setLegalEntityType,
    setTaxClassification,
    setLegalForm,
    setBillingAddressStructured,
  };
}
