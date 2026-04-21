import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useAction } from "convex/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeAddressSheet } from "@/components/sheets/profile/studio/stripe-address-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import {
  type BillingAddressStructured,
  type BillingProfileSnapshot,
  useStudioBillingForm,
} from "@/features/compliance/use-studio-billing-form";
import { useTheme } from "@/hooks/use-theme";
import { Box, HStack } from "@/primitives";

interface StudioBusinessInfoFormProps {
  billingProfile: BillingProfileSnapshot | null | undefined;
  saveBillingProfile: (payload: {
    country: string;
    legalEntityType: "individual" | "company";
    legalBusinessName: string;
    taxId: string;
    taxClassification?: string;
    companyRegNumber?: string;
    legalForm?: string;
    billingEmail: string;
    billingPhone?: string;
    billingAddress?: string;
    billingAddressStructured?: BillingAddressStructured;
  }) => Promise<unknown>;
  currentUserEmail?: string;
  currentUserPhone?: string;
  defaultBusinessName?: string;
  defaultCountryCode?: string;
  autoSave?: boolean;
}

const SUPPORTED_COUNTRIES = [
  "DE",
  "FR",
  "UK",
  "ES",
  "IT",
  "NL",
  "PT",
  "IE",
  "BE",
  "AT",
  "IL",
] as const;

function getCountryLabel(countryCode: string, locale: string) {
  try {
    const normalizedCountry = countryCode === "UK" ? "GB" : countryCode;
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(normalizedCountry) ?? normalizedCountry;
  } catch {
    return countryCode === "UK" ? "GB" : countryCode;
  }
}

export function StudioBusinessInfoForm({
  billingProfile,
  saveBillingProfile,
  currentUserEmail,
  currentUserPhone,
  defaultBusinessName,
  defaultCountryCode,
  autoSave = true,
}: StudioBusinessInfoFormProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const lookupMyStudioBusinessIdentity = useAction(
    api.compliance.studioBusinessLookup.lookupMyStudioBusinessIdentity,
  );
  const form = useStudioBillingForm(
    billingProfile,
    saveBillingProfile,
    currentUserEmail,
    currentUserPhone,
    defaultBusinessName,
    autoSave,
    defaultCountryCode,
  );
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [countrySheetVisible, setCountrySheetVisible] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [registryFeedback, setRegistryFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isLookingUpRegistry, setIsLookingUpRegistry] = useState(false);

  const handleAddressResult = (result: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }) => {
    if (result.address) {
      const structured: BillingAddressStructured = {
        line1: result.address.line1 ?? "",
        city: result.address.city ?? "",
        postalCode: result.address.postalCode ?? "",
        ...(result.address.line2 ? { line2: result.address.line2 } : {}),
        ...(result.address.state ? { state: result.address.state } : {}),
        ...(result.address.country ? { country: result.address.country } : {}),
      };
      form.setBillingAddressStructured(structured);
      const parts = [
        structured.line1,
        structured.line2,
        structured.city,
        structured.state,
        structured.postalCode,
        structured.country,
      ]
        .filter(Boolean)
        .join(", ");
      form.updateField("billingAddress", parts);
    }
    setAddressSheetVisible(false);
  };

  const countryConfig = form.countryConfig;
  const countryLabel = getCountryLabel(form.fields.country, i18n.resolvedLanguage ?? "en");
  const registryLookupSupported = ["FR", "DE", "UK", "GB"].includes(form.fields.country);

  const handleRegistryLookup = async () => {
    setRegistryFeedback(null);
    setIsLookingUpRegistry(true);
    try {
      const lookupCountry = form.fields.country === "GB" ? "UK" : form.fields.country;
      const result = await lookupMyStudioBusinessIdentity({
        country: lookupCountry as "FR" | "DE" | "UK",
        legalBusinessName: form.fields.legalBusinessName || undefined,
        taxId: form.fields.taxId || undefined,
        companyRegNumber: form.fields.companyRegNumber || undefined,
      });

      if (result.status !== "found") {
        setRegistryFeedback({
          tone: "error",
          message:
            result.message ??
            t("profile.studioCompliance.billing.registryNotFound", {
              defaultValue: "No registry match found for the current business details.",
            }),
        });
        return;
      }

      if (result.country && result.country !== form.fields.country) {
        form.setCountry(result.country);
      }
      if (result.legalBusinessName) {
        form.updateField("legalBusinessName", result.legalBusinessName);
      }
      if (result.taxId) {
        form.updateField("taxId", result.taxId);
      }
      if (result.companyRegNumber) {
        form.updateField("companyRegNumber", result.companyRegNumber);
      }
      if (result.legalForm) {
        form.updateField("legalForm", result.legalForm);
      }
      if (result.billingAddressStructured) {
        form.setBillingAddressStructured(result.billingAddressStructured);
      }
      if (result.billingAddress) {
        form.updateField("billingAddress", result.billingAddress);
      }

      setRegistryFeedback({
        tone: "success",
        message: t("profile.studioCompliance.billing.registryAutofilled", {
          defaultValue: "Business details were autofilled from the public registry.",
        }),
      });
    } catch (error) {
      setRegistryFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Registry lookup failed",
      });
    } finally {
      setIsLookingUpRegistry(false);
    }
  };

  return (
    <>
      <Box style={{ gap: BrandSpacing.md }}>
        {form.feedback ? (
          <NoticeBanner
            tone={form.feedback.tone}
            message={form.feedback.message}
            onDismiss={() => undefined}
          />
        ) : null}

        <Box style={{ gap: BrandSpacing.xs }}>
          <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
            {t("profile.studioCompliance.billing.country")}
          </ThemedText>
          {!billingProfile?.country && defaultCountryCode ? (
            <ThemedText type="micro" style={{ color: theme.color.textMuted }}>
              {t("profile.studioCompliance.billing.detectedCountry", {
                country: getCountryLabel(defaultCountryCode, i18n.resolvedLanguage ?? "en"),
                defaultValue: `Detected from studio location: ${defaultCountryCode}`,
              })}
            </ThemedText>
          ) : null}
          <ThemedText type="micro" style={{ color: theme.color.textMuted }}>
            {t("profile.studioCompliance.billing.countryHint", {
              defaultValue: "You can change this country here if it does not match your business.",
            })}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCountrySheetVisible(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.md,
              borderRadius: BrandRadius.lg,
              borderWidth: 1,
              borderColor: pressed ? theme.color.borderStrong : theme.color.border,
              backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surface,
            })}
          >
            <View style={{ gap: 2, flex: 1 }}>
              <ThemedText type="bodyStrong" style={{ color: theme.color.text }}>
                {countryLabel}
              </ThemedText>
              <ThemedText type="micro" style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.billing.countryPickerHint", {
                  defaultValue: "Choose the country that matches your business registration.",
                })}
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.color.primary }}>
              {t("common.change")}
            </ThemedText>
          </Pressable>
        </Box>

        <Box style={{ gap: BrandSpacing.xs }}>
          <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
            {t("profile.studioCompliance.billing.entityType")}
          </ThemedText>
          <HStack style={{ gap: BrandSpacing.sm }}>
            <ChoicePill
              label={t("profile.studioCompliance.billing.entityIndividual")}
              selected={form.fields.legalEntityType === "individual"}
              onPress={() => form.updateField("legalEntityType", "individual")}
              backgroundColor={theme.color.surfaceElevated}
              selectedBackgroundColor={theme.color.primary}
              labelColor={theme.color.text}
              selectedLabelColor={theme.color.onPrimary}
            />
            <ChoicePill
              label={t("profile.studioCompliance.billing.entityCompany")}
              selected={form.fields.legalEntityType === "company"}
              onPress={() => form.updateField("legalEntityType", "company")}
              backgroundColor={theme.color.surfaceElevated}
              selectedBackgroundColor={theme.color.primary}
              labelColor={theme.color.text}
              selectedLabelColor={theme.color.onPrimary}
            />
          </HStack>
        </Box>

        <KitTextField
          label={t("profile.studioCompliance.billing.legalBusinessName")}
          value={form.fields.legalBusinessName}
          onChangeText={(v) => form.updateField("legalBusinessName", v)}
        />

        <KitTextField
          label={t(countryConfig.taxIdLabelKey as never)}
          value={form.fields.taxId}
          onChangeText={(v) => form.updateField("taxId", v)}
          placeholder={
            countryConfig.taxIdPlaceholderKey
              ? t(countryConfig.taxIdPlaceholderKey as never)
              : undefined
          }
        />

        <KitTextField
          label={t("profile.studioCompliance.billing.billingEmail")}
          value={form.fields.billingEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(v) => form.updateField("billingEmail", v)}
        />

        <Box style={{ gap: BrandSpacing.sm }}>
          <KitTextField
            label={t("profile.studioCompliance.billing.billingAddress")}
            value={form.fields.billingAddress}
            onChangeText={(v) => form.updateField("billingAddress", v)}
          />
          {Platform.OS !== "web" ? (
            <ActionButton
              label={t("profile.studioCompliance.billing.useStripeAddress")}
              tone="secondary"
              fullWidth
              onPress={() => setAddressSheetVisible(true)}
            />
          ) : null}
        </Box>

        <ActionButton
          label={
            showAdvancedFields
              ? t("profile.studioCompliance.billing.hideMoreDetails")
              : t("profile.studioCompliance.billing.moreDetails")
          }
          tone="secondary"
          fullWidth
          onPress={() => setShowAdvancedFields((current) => !current)}
        />

        {showAdvancedFields ? (
          <Box style={{ gap: BrandSpacing.md }}>
            {registryFeedback ? (
              <NoticeBanner
                tone={registryFeedback.tone}
                message={registryFeedback.message}
                onDismiss={() => setRegistryFeedback(null)}
              />
            ) : null}

            {registryLookupSupported ? (
              <ActionButton
                label={t("profile.studioCompliance.billing.registryAutofill", {
                  defaultValue: "Autofill from registry",
                })}
                tone="secondary"
                fullWidth
                loading={isLookingUpRegistry}
                disabled={isLookingUpRegistry}
                onPress={() => {
                  void handleRegistryLookup();
                }}
              />
            ) : null}

            {countryConfig.vatClassifications.length > 0 ? (
              <Box style={{ gap: BrandSpacing.xs }}>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("profile.studioCompliance.billing.taxClassification")}
                </ThemedText>
                <HStack style={{ flexWrap: "wrap", gap: BrandSpacing.sm }}>
                  {countryConfig.vatClassifications.map((opt) => (
                    <ChoicePill
                      key={opt.value}
                      label={t(opt.labelKey as never)}
                      selected={form.fields.taxClassification === opt.value}
                      onPress={() => form.updateField("taxClassification", opt.value)}
                      backgroundColor={theme.color.surfaceElevated}
                      selectedBackgroundColor={theme.color.primary}
                      labelColor={theme.color.text}
                      selectedLabelColor={theme.color.onPrimary}
                    />
                  ))}
                </HStack>
              </Box>
            ) : null}

            {countryConfig.showCompanyRegNumber && form.fields.legalEntityType === "company" ? (
              <KitTextField
                label={t(
                  (countryConfig.companyRegLabelKey ??
                    "profile.studioCompliance.billing.companyReg") as never,
                )}
                value={form.fields.companyRegNumber}
                onChangeText={(v) => form.updateField("companyRegNumber", v)}
              />
            ) : null}

            {countryConfig.showLegalForm &&
            form.fields.legalEntityType === "company" &&
            countryConfig.legalFormOptions ? (
              <Box style={{ gap: BrandSpacing.xs }}>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("profile.studioCompliance.billing.legalForm")}
                </ThemedText>
                <HStack style={{ flexWrap: "wrap", gap: BrandSpacing.sm }}>
                  {countryConfig.legalFormOptions.map((opt) => (
                    <ChoicePill
                      key={opt.value}
                      label={t(opt.labelKey as never)}
                      selected={form.fields.legalForm === opt.value}
                      onPress={() => form.updateField("legalForm", opt.value)}
                      backgroundColor={theme.color.surfaceElevated}
                      selectedBackgroundColor={theme.color.primary}
                      labelColor={theme.color.text}
                      selectedLabelColor={theme.color.onPrimary}
                    />
                  ))}
                </HStack>
              </Box>
            ) : null}

            <KitTextField
              label={t("profile.studioCompliance.billing.billingPhone")}
              value={form.fields.billingPhone}
              keyboardType="phone-pad"
              onChangeText={(v) => form.updateField("billingPhone", v)}
            />
          </Box>
        ) : null}

        {!autoSave ? (
          <ActionButton
            label={t("profile.studioCompliance.billing.saveDetails")}
            fullWidth
            loading={form.isSaving}
            disabled={form.isSaving}
            onPress={() => {
              void form.save();
            }}
          />
        ) : null}
      </Box>

      <StripeAddressSheet
        visible={addressSheetVisible}
        sheetTitle={t("profile.studioCompliance.billing.billingAddress")}
        primaryButtonTitle={t("common.save")}
        onSubmit={handleAddressResult}
        onError={() => setAddressSheetVisible(false)}
      />

      <BaseProfileSheet
        visible={countrySheetVisible}
        onClose={() => setCountrySheetVisible(false)}
        snapPoints={["70%"]}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ gap: BrandSpacing.sm, paddingBottom: BrandSpacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          <Box style={{ gap: BrandSpacing.xs }}>
            <ThemedText type="title">{t("profile.studioCompliance.billing.country")}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {t("profile.studioCompliance.billing.countryPickerHint", {
                defaultValue: "Choose the country that matches your business registration.",
              })}
            </ThemedText>
          </Box>
          <Box style={{ gap: BrandSpacing.sm }}>
            {SUPPORTED_COUNTRIES.map((countryCode) => {
              const isSelected = form.fields.country === countryCode;
              return (
                <Pressable
                  key={countryCode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={async () => {
                    form.setCountry(countryCode);
                    setCountrySheetVisible(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.md,
                    borderRadius: BrandRadius.lg,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.color.primary : theme.color.border,
                    backgroundColor: isSelected
                      ? theme.color.primarySubtle
                      : pressed
                        ? theme.color.surfaceElevated
                        : theme.color.surface,
                  })}
                >
                  <View style={{ gap: 2 }}>
                    <ThemedText type="bodyStrong" style={{ color: theme.color.text }}>
                      {getCountryLabel(countryCode, i18n.resolvedLanguage ?? "en")}
                    </ThemedText>
                    <ThemedText type="micro" style={{ color: theme.color.textMuted }}>
                      {countryCode}
                    </ThemedText>
                  </View>
                  {isSelected ? (
                    <ThemedText type="caption" style={{ color: theme.color.primary }}>
                      {t("common.selected")}
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </Box>
        </BottomSheetScrollView>
      </BaseProfileSheet>
    </>
  );
}
