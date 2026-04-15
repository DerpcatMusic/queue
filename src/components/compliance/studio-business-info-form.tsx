import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { StripeAddressSheet } from "@/components/sheets/profile/studio/stripe-address-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import {
  type BillingAddressStructured,
  type BillingProfileSnapshot,
  useStudioBillingForm,
} from "@/features/compliance/use-studio-billing-form";
import { useTheme } from "@/hooks/use-theme";
import { Box, HStack } from "@/primitives";

interface StudioBusinessInfoFormProps {
  billingProfile: BillingProfileSnapshot | null | undefined;
  currentUserEmail?: string;
  currentUserPhone?: string;
  defaultBusinessName?: string;
  autoSave?: boolean;
}

const SUPPORTED_COUNTRIES = [
  { value: "IL", labelKey: "common.countries.IL" },
  { value: "DE", labelKey: "common.countries.DE" },
  { value: "FR", labelKey: "common.countries.FR" },
  { value: "ES", labelKey: "common.countries.ES" },
];

export function StudioBusinessInfoForm({
  billingProfile,
  currentUserEmail,
  currentUserPhone,
  defaultBusinessName,
  autoSave = true,
}: StudioBusinessInfoFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const form = useStudioBillingForm(
    billingProfile,
    currentUserEmail,
    currentUserPhone,
    defaultBusinessName,
    autoSave,
  );
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

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
          <HStack style={{ flexWrap: "wrap", gap: BrandSpacing.sm }}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <ChoicePill
                key={c.value}
                label={t(c.labelKey as never)}
                selected={form.fields.country === c.value}
                onPress={() => form.updateField("country", c.value)}
                backgroundColor={theme.color.surfaceElevated}
                selectedBackgroundColor={theme.color.primary}
                labelColor={theme.color.text}
                selectedLabelColor={theme.color.onPrimary}
              />
            ))}
          </HStack>
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
    </>
  );
}
