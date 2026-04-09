// Step 2 - Studio compliance body
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import {
  getIdentityStatusLabel,
  IdentityStatusBadge,
} from "@/components/profile/identity-status-ui";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import {
  getStudioBlockingSummary as getSharedStudioBlockingSummary,
  getStudioPaymentSubtitle,
} from "@/features/compliance/compliance-ui";
import { useTheme } from "@/hooks/use-theme";

type StudioDiditVerification = { status: string; isVerified: boolean; legalName?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OnboardingStyles = Record<string, any>;

interface StepStudioComplianceBodyProps {
  currentUser:
    | { role?: string; fullName?: string | null; email?: string | null }
    | null
    | undefined;
  studioDiditVerification: StudioDiditVerification | undefined | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onboardingStudioCompliance: any;
  verificationFeedback: { tone: "success" | "error"; message: string } | null;
  setVerificationFeedback: (
    feedback: { tone: "success" | "error"; message: string } | null,
  ) => void;
  isStartingStudioDidit: boolean;
  isSavingStudioBilling: boolean;
  studioLegalEntityType: "individual" | "company";
  setStudioLegalEntityType: (type: "individual" | "company") => void;
  studioVatReportingType: "osek_patur" | "osek_murshe" | "company" | "other" | null;
  setStudioVatReportingType: (
    type: "osek_patur" | "osek_murshe" | "company" | "other" | null,
  ) => void;
  studioLegalBusinessName: string;
  setStudioLegalBusinessName: (name: string) => void;
  studioTaxId: string;
  setStudioTaxId: (id: string) => void;
  studioBillingEmail: string;
  setStudioBillingEmail: (email: string) => void;
  studioBillingAddress: string;
  setStudioBillingAddress: (address: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildRoleTabRoute: any;
  ROLE_TAB_ROUTE_NAMES: { jobs: string };
  saveStudioBillingFromOnboarding: () => Promise<void>;
  startStudioDiditFromOnboarding: () => Promise<void>;
  refreshStudioDiditFromOnboarding: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: OnboardingStyles;
}

function getStudioBlockingSummary(
  reasons: string[],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return getSharedStudioBlockingSummary(reasons, t);
}

export function StepStudioComplianceBody({
  currentUser,
  studioDiditVerification,
  onboardingStudioCompliance,
  verificationFeedback,
  setVerificationFeedback,
  isStartingStudioDidit,
  isSavingStudioBilling,
  studioLegalEntityType,
  setStudioLegalEntityType,
  studioVatReportingType,
  setStudioVatReportingType,
  studioLegalBusinessName,
  setStudioLegalBusinessName,
  studioTaxId,
  setStudioTaxId,
  studioBillingEmail,
  setStudioBillingEmail,
  studioBillingAddress,
  setStudioBillingAddress,
  router,
  buildRoleTabRoute,
  ROLE_TAB_ROUTE_NAMES,
  saveStudioBillingFromOnboarding,
  startStudioDiditFromOnboarding,
  styles,
}: StepStudioComplianceBodyProps) {
  const { t } = useTranslation();
  const { color } = useTheme();

  if (
    currentUser?.role !== "studio" ||
    studioDiditVerification == null ||
    onboardingStudioCompliance == null
  ) {
    return (
      <View style={styles.detailsLoadingStage}>
        <View style={styles.detailsLoadingHeader}>
          <ThemedText type="title">{t("profile.studioCompliance.loading")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {t("onboarding.verification.studioBody")}
          </ThemedText>
        </View>
        <View style={styles.detailsLoadingRow}>
          <ActivityIndicator color={color.primary} />
          <ThemedText style={{ color: color.textMuted }}>
            {t("profile.studioCompliance.loading")}
          </ThemedText>
        </View>
      </View>
    );
  }

  const studioComplianceDetails = onboardingStudioCompliance;
  const studioDiditState = studioDiditVerification;
  const blockersSummary = getStudioBlockingSummary(
    studioComplianceDetails.summary.blockingReasons,
    t,
  );

  return (
    <View
      style={[
        styles.verifyStage,
        { backgroundColor: color.surface, borderColor: color.borderStrong },
      ]}
    >
      {verificationFeedback ? (
        <NoticeBanner
          tone={verificationFeedback.tone}
          message={verificationFeedback.message}
          onDismiss={() => setVerificationFeedback(null)}
        />
      ) : null}
      <View style={styles.sectionBlock}>
        <ThemedText type="subtitle">
          {studioComplianceDetails.summary.canPublishJobs
            ? t("profile.studioCompliance.hero.readyTitle")
            : t("profile.studioCompliance.hero.blockedTitle")}
        </ThemedText>
        <ThemedText style={{ color: color.textMuted }}>
          {studioComplianceDetails.summary.canPublishJobs
            ? t("profile.studioCompliance.hero.readyBody")
            : t("profile.studioCompliance.hero.blockedBody", { blockers: blockersSummary })}
        </ThemedText>
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceAlt, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.verificationCardHeader}>
          <ThemedText type="defaultSemiBold">
            {t("profile.studioCompliance.sections.identity")}
          </ThemedText>
          <IdentityStatusBadge status={studioDiditState.status} />
        </View>
        <ThemedText style={{ color: color.textMuted }}>
          {studioDiditState.isVerified
            ? t("profile.studioCompliance.identity.approvedBody", {
                legalName:
                  studioDiditState.legalName ??
                  currentUser.fullName ??
                  t("profile.account.fallbackName"),
              })
            : t("profile.studioCompliance.identity.requiredBody", {
                status: getIdentityStatusLabel(studioDiditState.status),
              })}
        </ThemedText>
        {!studioDiditState.isVerified ? (
          <ActionButton
            label={t("profile.identityVerification.verifyNow")}
            fullWidth
            native={false}
            loading={isStartingStudioDidit}
            disabled={isStartingStudioDidit}
            colors={{
              backgroundColor: color.primary,
              pressedBackgroundColor: color.primary,
              disabledBackgroundColor: color.surfaceAlt,
              labelColor: color.onPrimary,
              disabledLabelColor: color.onPrimary,
              nativeTintColor: color.primary,
            }}
            labelStyle={{ textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" }}
            onPress={() => {
              void startStudioDiditFromOnboarding();
            }}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceAlt, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.sectionBlock}>
          <View style={styles.verificationCardHeader}>
            <ThemedText type="defaultSemiBold">
              {t("profile.studioCompliance.sections.billing")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {studioComplianceDetails.summary.businessProfileStatus === "complete"
                ? t("profile.compliance.values.approved")
                : t("profile.compliance.values.actionRequired")}
            </ThemedText>
          </View>
          <View style={styles.chipGrid}>
            <ChoicePill
              label={t("profile.studioCompliance.billing.entityIndividual")}
              selected={studioLegalEntityType === "individual"}
              onPress={() => setStudioLegalEntityType("individual")}
            />
            <ChoicePill
              label={t("profile.studioCompliance.billing.entityCompany")}
              selected={studioLegalEntityType === "company"}
              onPress={() => setStudioLegalEntityType("company")}
            />
          </View>
          <KitTextField
            label={t("profile.studioCompliance.billing.legalBusinessName")}
            value={studioLegalBusinessName}
            onChangeText={setStudioLegalBusinessName}
          />
          <KitTextField
            label={t("profile.studioCompliance.billing.taxId")}
            value={studioTaxId}
            onChangeText={setStudioTaxId}
          />
          <KitTextField
            label={t("profile.studioCompliance.billing.billingEmail")}
            value={studioBillingEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setStudioBillingEmail}
          />
          <KitTextField
            label={t("profile.studioCompliance.billing.billingAddress")}
            value={studioBillingAddress}
            onChangeText={setStudioBillingAddress}
          />
          <View style={styles.chipGrid}>
            {(["osek_patur", "osek_murshe", "company", "other"] as const).map((value) => (
              <ChoicePill
                key={value}
                label={t(`profile.studioCompliance.billing.vatOptions.${value}` as const)}
                selected={studioVatReportingType === value}
                onPress={() => setStudioVatReportingType(value)}
              />
            ))}
          </View>
          <ActionButton
            label={t("profile.studioCompliance.actions.saveBilling")}
            fullWidth
            loading={isSavingStudioBilling}
            disabled={isSavingStudioBilling}
            onPress={() => void saveStudioBillingFromOnboarding()}
          />
        </View>
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceAlt, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.verificationCardHeader}>
          <ThemedText type="defaultSemiBold">
            {t("profile.studioCompliance.sections.payment")}
          </ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {studioComplianceDetails.summary.paymentStatus === "ready"
              ? t("profile.compliance.values.approved")
              : t("profile.compliance.values.pending")}
          </ThemedText>
        </View>
        <ThemedText style={{ color: color.textMuted }}>
          {getStudioPaymentSubtitle(
            {
              status: studioComplianceDetails.summary.paymentStatus,
              paymentReadinessSource: studioComplianceDetails.summary.paymentReadinessSource,
            },
            t,
          )}
        </ThemedText>
        <ActionButton
          label={t("onboarding.verification.openCompliance")}
          tone="secondary"
          fullWidth
          onPress={() => router.replace("/studio/profile/compliance")}
        />
      </View>
      <View style={styles.verifyActions}>
        <ActionButton
          label={
            studioComplianceDetails.summary.canPublishJobs
              ? t("onboarding.verification.openJobsReady")
              : t("onboarding.verification.openJobsWhileReviewing")
          }
          fullWidth
          onPress={() => router.replace(buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs))}
        />
        <ActionButton
          label={t("onboarding.verification.openCompliance")}
          tone="secondary"
          fullWidth
          onPress={() => router.replace("/studio/profile/compliance")}
        />
      </View>
    </View>
  );
}
