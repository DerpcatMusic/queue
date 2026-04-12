import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeAddressSheet } from "@/components/sheets/profile/studio/stripe-address-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, HStack } from "@/primitives";
import {
  useStudioBillingForm,
  type BillingProfileSnapshot,
  type BillingAddressStructured,
} from "@/features/compliance/use-studio-billing-form";

interface StudioBusinessInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  billingProfile: BillingProfileSnapshot | null | undefined;
  currentUserEmail?: string;
  currentUserPhone?: string;
}

const SUPPORTED_COUNTRIES = [
  { value: "IL", labelKey: "common.countries.IL" },
  { value: "DE", labelKey: "common.countries.DE" },
  { value: "FR", labelKey: "common.countries.FR" },
  { value: "ES", labelKey: "common.countries.ES" },
];

export function StudioBusinessInfoSheet({
  visible,
  onClose,
  billingProfile,
  currentUserEmail,
  currentUserPhone,
}: StudioBusinessInfoSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const form = useStudioBillingForm(
    billingProfile,
    currentUserEmail,
    currentUserPhone,
  );

  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const countryConfig = form.countryConfig;
  const hasExistingProfile = billingProfile?.status === "complete";

  const handleCountryChange = (newCountry: string) => {
    if (hasExistingProfile && newCountry !== form.fields.country) {
      Alert.alert(
        t("profile.studioCompliance.billing.changeCountryTitle"),
        t("profile.studioCompliance.billing.changeCountryBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.confirm"),
            style: "destructive",
            onPress: () => {
              form.setCountry(newCountry);
              form.setTaxClassification("");
            },
          },
        ],
      );
      return;
    }
    form.setCountry(newCountry);
    form.setTaxClassification("");
  };

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

  const handleClose = () => {
    if (form.isDirty()) {
      Alert.alert(
        t("profile.studioCompliance.billing.unsavedTitle"),
        t("profile.studioCompliance.billing.unsavedBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.discard"),
            style: "destructive",
            onPress: onClose,
          },
        ],
      );
      return;
    }
    onClose();
  };

  return (
    <>
      <BaseProfileSheet visible={visible} onClose={handleClose} scrollable>
        <BottomSheetScrollView
          contentContainerStyle={{
            gap: BrandSpacing.md,
            backgroundColor: theme.color.appBg,
          }}
        >
          <Box style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.md }}>
            {/* Country selector */}
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
                    onPress={() => handleCountryChange(c.value)}
                    backgroundColor={theme.color.surfaceElevated}
                    selectedBackgroundColor={theme.color.primary}
                    labelColor={theme.color.text}
                    selectedLabelColor={theme.color.onPrimary}
                  />
                ))}
              </HStack>
            </Box>

            {/* Entity type */}
            <Box style={{ gap: BrandSpacing.xs }}>
              <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.billing.entityType")}
              </ThemedText>
              <HStack style={{ gap: BrandSpacing.sm }}>
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityIndividual")}
                  selected={form.fields.legalEntityType === "individual"}
                  onPress={() => form.setLegalEntityType("individual")}
                  backgroundColor={theme.color.surfaceElevated}
                  selectedBackgroundColor={theme.color.primary}
                  labelColor={theme.color.text}
                  selectedLabelColor={theme.color.onPrimary}
                />
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityCompany")}
                  selected={form.fields.legalEntityType === "company"}
                  onPress={() => form.setLegalEntityType("company")}
                  backgroundColor={theme.color.surfaceElevated}
                  selectedBackgroundColor={theme.color.primary}
                  labelColor={theme.color.text}
                  selectedLabelColor={theme.color.onPrimary}
                />
              </HStack>
            </Box>

            {/* Legal business name */}
            <KitTextField
              label={t("profile.studioCompliance.billing.legalBusinessName")}
              value={form.fields.legalBusinessName}
              onChangeText={(v) => form.updateField("legalBusinessName", v)}
            />

            {/* Tax ID — country-specific label */}
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

            {/* Tax/VAT classification — country-specific options */}
            {countryConfig.vatClassifications.length > 0 && (
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
                      onPress={() => form.setTaxClassification(opt.value)}
                      backgroundColor={theme.color.surfaceElevated}
                      selectedBackgroundColor={theme.color.primary}
                      labelColor={theme.color.text}
                      selectedLabelColor={theme.color.onPrimary}
                    />
                  ))}
                </HStack>
              </Box>
            )}

            {/* Company registration number (country-specific) */}
            {countryConfig.showCompanyRegNumber &&
              form.fields.legalEntityType === "company" && (
                <KitTextField
                  label={t((countryConfig.companyRegLabelKey ?? "profile.studioCompliance.billing.companyReg") as never)}
                  value={form.fields.companyRegNumber}
                  onChangeText={(v) => form.updateField("companyRegNumber", v)}
                />
              )}

            {/* Legal form (country-specific, company only) */}
            {countryConfig.showLegalForm &&
              form.fields.legalEntityType === "company" &&
              countryConfig.legalFormOptions && (
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
                        onPress={() => form.setLegalForm(opt.value)}
                        backgroundColor={theme.color.surfaceElevated}
                        selectedBackgroundColor={theme.color.primary}
                        labelColor={theme.color.text}
                        selectedLabelColor={theme.color.onPrimary}
                      />
                    ))}
                  </HStack>
                </Box>
              )}

            {/* Billing email */}
            <KitTextField
              label={t("profile.studioCompliance.billing.billingEmail")}
              value={form.fields.billingEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(v) => form.updateField("billingEmail", v)}
            />

            {/* Billing phone */}
            <KitTextField
              label={t("profile.studioCompliance.billing.billingPhone")}
              value={form.fields.billingPhone}
              keyboardType="phone-pad"
              onChangeText={(v) => form.updateField("billingPhone", v)}
            />

            {/* Billing address */}
            <Box style={{ gap: BrandSpacing.sm }}>
              <KitTextField
                label={t("profile.studioCompliance.billing.billingAddress")}
                value={form.fields.billingAddress}
                onChangeText={(v) => form.updateField("billingAddress", v)}
              />
              {Platform.OS !== "web" && (
                <ActionButton
                  label={t("profile.studioCompliance.billing.useStripeAddress")}
                  tone="secondary"
                  fullWidth
                  onPress={() => setAddressSheetVisible(true)}
                />
              )}
            </Box>
          </Box>
        </BottomSheetScrollView>
      </BaseProfileSheet>

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
