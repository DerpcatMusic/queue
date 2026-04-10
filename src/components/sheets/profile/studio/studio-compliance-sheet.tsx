import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, RefreshControl } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { LoadingScreen } from "@/components/loading-screen";
import {
  getIdentityStatusLabel,
  IdentityStatusBadge,
} from "@/components/profile/identity-status-ui";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeAddressSheet } from "@/components/sheets/profile/studio/stripe-address-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { getStudioPaymentSubtitle } from "@/features/compliance/compliance-ui";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

type BillingProfile = {
  legalEntityType: "individual" | "company";
  status: "incomplete" | "complete";
  legalBusinessName?: string;
  taxId?: string;
  vatReportingType?: "osek_patur" | "osek_murshe" | "company" | "other";
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  completedAt?: number;
};

interface StudioComplianceSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioComplianceSheet({ visible, onClose }: StudioComplianceSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  const currentUser = useQuery(api.users.getCurrentUser);
  const shouldLoad = currentUser?.role === "studio";
  const accessSnapshot = useQuery(api.access.getMyStudioAccessSnapshot, shouldLoad ? {} : "skip");
  const compliance = accessSnapshot?.compliance;
  const diditVerification = accessSnapshot?.verification;
  const paymentsPreflight = useQuery(
    api.paymentsV2.getPaymentsPreflightV2,
    shouldLoad ? {} : "skip",
  );
  const saveBillingProfile = useMutation(api.complianceStudio.upsertMyStudioBillingProfile);

  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const billingProfile = compliance?.billingProfile as BillingProfile | null | undefined;
  const [legalEntityType, setLegalEntityType] = useState<"individual" | "company">("individual");
  const [vatReportingType, setVatReportingType] = useState<
    "osek_patur" | "osek_murshe" | "company" | "other" | null
  >(null);
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingAddressSheetVisible, setBillingAddressSheetVisible] = useState(false);

  useEffect(() => {
    if (billingProfile) {
      setLegalEntityType(billingProfile.legalEntityType);
      setVatReportingType(billingProfile.vatReportingType ?? null);
      setLegalBusinessName(billingProfile.legalBusinessName ?? "");
      setTaxId(billingProfile.taxId ?? "");
      setBillingEmail(billingProfile.billingEmail ?? currentUser?.email ?? "");
      setBillingPhone(billingProfile.billingPhone ?? currentUser?.phoneE164 ?? "");
      setBillingAddress(billingProfile.billingAddress ?? "");
      return;
    }

    setBillingEmail(currentUser?.email ?? "");
    setBillingPhone(currentUser?.phoneE164 ?? "");
  }, [billingProfile, currentUser?.email, currentUser?.phoneE164]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setRefreshing(false);
  }, []);

  const saveBilling = useCallback(async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveBillingProfile({
        legalEntityType,
        legalBusinessName,
        taxId,
        billingEmail,
        ...(vatReportingType ? { vatReportingType } : {}),
        ...(billingPhone.trim() ? { billingPhone } : {}),
        ...(billingAddress.trim() ? { billingAddress } : {}),
      });
      setFeedback({
        tone: "success",
        message: t("profile.studioCompliance.feedback.billingSaved"),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : t("profile.studioCompliance.errors.billingSaveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    billingAddress,
    billingEmail,
    billingPhone,
    legalBusinessName,
    legalEntityType,
    saveBillingProfile,
    t,
    taxId,
    vatReportingType,
  ]);

  const formatBillingAddress = useCallback(
    (details: {
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    }) => {
      const parts = [
        details.address?.line1,
        details.address?.line2,
        details.address?.city,
        details.address?.state,
        details.address?.postalCode,
        details.address?.country,
      ]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));
      return parts.join(", ");
    },
    [],
  );

  if (
    !currentUser ||
    (shouldLoad &&
      (compliance === undefined ||
        diditVerification === undefined ||
        paymentsPreflight === undefined))
  ) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.studioCompliance.loading")} />
      </BaseProfileSheet>
    );
  }

  if (
    !currentUser ||
    currentUser.role !== "studio" ||
    !compliance ||
    !diditVerification ||
    !paymentsPreflight
  ) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box
          style={{
            flex: 1,
            paddingHorizontal: BrandSpacing.inset,
            paddingVertical: BrandSpacing.xl,
            gap: BrandSpacing.sm,
          }}
        >
          <ThemedText selectable style={BrandType.title}>
            {t("profile.studioCompliance.hero.blockedTitle")}
          </ThemedText>
          <ThemedText selectable type="caption" style={{ color: theme.color.textMuted }}>
            {t("profile.studioCompliance.loading")}
          </ThemedText>
        </Box>
      </BaseProfileSheet>
    );
  }

  const paymentStatus =
    paymentsPreflight.readyForCheckout && compliance.summary.paymentStatus === "ready"
      ? "ready"
      : compliance.summary.paymentStatus;
  const paymentSubtitle = getStudioPaymentSubtitle(
    {
      status: paymentStatus,
      paymentReadinessSource: compliance.summary.paymentReadinessSource,
    },
    t,
  );
  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <BottomSheetScrollView
        contentContainerStyle={{ gap: BrandSpacing.xl, backgroundColor: theme.color.appBg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} />
        }
      >
        <Box style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.xl }}>
          {feedback ? (
            <NoticeBanner
              tone={feedback.tone}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
            />
          ) : null}

          <Box style={{ gap: BrandSpacing.sm }}>
            <ThemedText selectable style={BrandType.title}>
              {compliance.summary.canPublishJobs
                ? t("profile.studioCompliance.hero.readyTitle")
                : t("profile.studioCompliance.hero.blockedTitle")}
            </ThemedText>
          </Box>

          <Box>
            <ProfileSectionHeader
              label={t("profile.studioCompliance.sections.identity")}
              description={t("profile.studioCompliance.sections.identityDescription")}
              icon="person.text.rectangle.fill"
            />
            <ProfileSectionCard style={{ marginHorizontal: 0 }}>
              <Box style={{ gap: BrandSpacing.md, padding: BrandSpacing.md }}>
                <Box
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: BrandSpacing.sm,
                  }}
                >
                  <ThemedText type="defaultSemiBold">
                    {t("profile.studioCompliance.identity.title")}
                  </ThemedText>
                  <IdentityStatusBadge status={diditVerification.status} />
                </Box>
                <ThemedText style={{ color: theme.color.textMuted }}>
                  {diditVerification.isVerified
                    ? t("profile.studioCompliance.identity.approvedBody")
                    : t("profile.studioCompliance.identity.requiredBody", {
                        status: getIdentityStatusLabel(diditVerification.status),
                      })}
                </ThemedText>
              </Box>
            </ProfileSectionCard>
          </Box>

          <Box>
            <ProfileSectionHeader
              label={t("profile.studioCompliance.sections.billing")}
              description={t("profile.studioCompliance.sections.billingDescription")}
              icon="doc.text.fill"
            />
            <ProfileSectionCard style={{ marginHorizontal: 0 }}>
              <Box style={{ gap: BrandSpacing.md, padding: BrandSpacing.md }}>
                <Box
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: BrandSpacing.sm,
                  }}
                >
                  <ChoicePill
                    label={t("profile.studioCompliance.billing.entityIndividual")}
                    selected={legalEntityType === "individual"}
                    onPress={() => setLegalEntityType("individual")}
                    backgroundColor={theme.color.surfaceElevated}
                    selectedBackgroundColor={theme.color.primary}
                    labelColor={theme.color.text}
                    selectedLabelColor={theme.color.onPrimary}
                  />
                  <ChoicePill
                    label={t("profile.studioCompliance.billing.entityCompany")}
                    selected={legalEntityType === "company"}
                    onPress={() => setLegalEntityType("company")}
                    backgroundColor={theme.color.surfaceElevated}
                    selectedBackgroundColor={theme.color.primary}
                    labelColor={theme.color.text}
                    selectedLabelColor={theme.color.onPrimary}
                  />
                </Box>

                <KitTextField
                  label={t("profile.studioCompliance.billing.legalBusinessName")}
                  value={legalBusinessName}
                  onChangeText={setLegalBusinessName}
                />
                <KitTextField
                  label={t("profile.studioCompliance.billing.taxId")}
                  value={taxId}
                  onChangeText={setTaxId}
                />
                <KitTextField
                  label={t("profile.studioCompliance.billing.billingEmail")}
                  value={billingEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setBillingEmail}
                />
                <KitTextField
                  label={t("profile.studioCompliance.billing.billingPhone")}
                  value={billingPhone}
                  keyboardType="phone-pad"
                  onChangeText={setBillingPhone}
                />
                <KitTextField
                  label={t("profile.studioCompliance.billing.billingAddress")}
                  value={billingAddress}
                  onChangeText={setBillingAddress}
                />
                <ActionButton
                  label={t("profile.studioCompliance.billing.useStripeAddress")}
                  tone="secondary"
                  fullWidth
                  onPress={() => setBillingAddressSheetVisible(true)}
                  disabled={Platform.OS === "web"}
                />

                <Box style={{ gap: BrandSpacing.xs }}>
                  <Box
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: BrandSpacing.sm,
                    }}
                  >
                    {(["osek_patur", "osek_murshe", "company", "other"] as const).map((value) => (
                      <ChoicePill
                        key={value}
                        label={t(`profile.studioCompliance.billing.vatOptions.${value}` as const)}
                        selected={vatReportingType === value}
                        onPress={() => setVatReportingType(value)}
                        backgroundColor={theme.color.surfaceElevated}
                        selectedBackgroundColor={theme.color.primary}
                        labelColor={theme.color.text}
                        selectedLabelColor={theme.color.onPrimary}
                      />
                    ))}
                  </Box>
                </Box>

                <ActionButton
                  label={t("profile.studioCompliance.actions.saveBilling")}
                  fullWidth
                  loading={isSaving}
                  disabled={isSaving}
                  onPress={() => {
                    void saveBilling();
                  }}
                />
              </Box>
            </ProfileSectionCard>
          </Box>

          <Box>
            <ProfileSectionHeader
              label={t("profile.studioCompliance.sections.payment")}
              description={t("profile.studioCompliance.sections.paymentDescription")}
              icon="creditcard.fill"
            />
            <ProfileSectionCard style={{ marginHorizontal: 0 }}>
              <ProfileSettingRow
                title={t("profile.studioCompliance.payment.title")}
                subtitle={paymentSubtitle}
                value={
                  paymentStatus === "ready"
                    ? t("profile.compliance.values.approved")
                    : t("profile.compliance.values.actionRequired")
                }
                icon="creditcard.fill"
                onPress={() => router.push("/studio/profile/payments" as Href)}
              />
            </ProfileSectionCard>
          </Box>
        </Box>
      </BottomSheetScrollView>
      <StripeAddressSheet
        visible={billingAddressSheetVisible}
        sheetTitle={t("profile.studioCompliance.billing.billingAddress")}
        primaryButtonTitle={t("common.save")}
        onSubmit={(result) => {
          setBillingAddress(formatBillingAddress(result));
          setBillingAddressSheetVisible(false);
        }}
        onError={() => {
          setBillingAddressSheetVisible(false);
        }}
      />
    </BaseProfileSheet>
  );
}
