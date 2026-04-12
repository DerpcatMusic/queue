// Step 2 - Instructor compliance body
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { IdentityStatusBadge } from "@/components/profile/identity-status-ui";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import {
  getComplianceDocumentValue,
  getInstructorBlockingSummary,
  getCertificateSubtitle as getSharedCertificateSubtitle,
  getInsuranceSubtitle as getSharedInsuranceSubtitle,
  getLatestCertificate as getSharedLatestCertificate,
  getLatestCertificateForSport as getSharedLatestCertificateForSport,
  getPreferredInsurancePolicy as getSharedPreferredInsurancePolicy,
  toComplianceDisplayLabel,
} from "@/features/compliance/compliance-ui";
import { useTheme } from "@/hooks/use-theme";
import { getStripeMarketDefaults } from "@/lib/stripe";

type OnboardingComplianceCertificateRow = {
  sport?: string;
  specialties?: Array<{
    sport: string;
    capabilityTags?: string[];
  }>;
  reviewStatus:
    | "uploaded"
    | "ai_pending"
    | "ai_reviewing"
    | "approved"
    | "rejected"
    | "needs_resubmission";
  issuerName?: string;
  certificateTitle?: string;
  uploadedAt: number;
  reviewedAt?: number;
};

type OnboardingComplianceInsuranceRow = {
  reviewStatus:
    | "uploaded"
    | "ai_pending"
    | "ai_reviewing"
    | "approved"
    | "rejected"
    | "expired"
    | "needs_resubmission";
  issuerName?: string;
  policyNumber?: string;
  expiresOn?: string;
  expiresAt?: number;
  uploadedAt: number;
  reviewedAt?: number;
};

type OnboardingComplianceSummary = {
  canApplyToJobs: boolean;
  hasApprovedInsurance: boolean;
  blockingReasons: string[];
};

type DiditVerification = {
  status: string;
  isVerified: boolean;
  legalName?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OnboardingStyles = Record<string, any>;

interface StepInstructorComplianceBodyProps {
  currentUser: { role?: string } | null | undefined;
  diditVerification: DiditVerification | undefined | null;
  onboardingCompliance:
    | {
        insurancePolicies: OnboardingComplianceInsuranceRow[];
        certificates: OnboardingComplianceCertificateRow[];
        summary: OnboardingComplianceSummary;
      }
    | undefined
    | null;
  verificationFeedback: { tone: "success" | "error"; message: string } | null;
  setVerificationFeedback: (
    feedback: { tone: "success" | "error"; message: string } | null,
  ) => void;
  isUploading: boolean;
  openInsuranceUploadPicker: () => void;
  openCertificateUploadPicker: () => void;
  verificationSports: string[];
  pushToken: string | null;
  isRequestingPush: boolean;
  requestPushPermission: () => Promise<void>;
  createStripeEmbeddedSession: () => Promise<{ clientSecret: string }>;
  createStripeHostedAccountLink: () => Promise<{ onboardingUrl: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildRoleTabRoute: any;
  ROLE_TAB_ROUTE_NAMES: { jobs: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: OnboardingStyles;
}

function toDisplayLabel(value: string): string {
  return toComplianceDisplayLabel(value);
}

function getLatestCertificateForSport(
  rows: OnboardingComplianceCertificateRow[],
  sport: string,
): OnboardingComplianceCertificateRow | null {
  return getSharedLatestCertificateForSport(rows, sport);
}

function getBlockingSummary(reasons: string[], t: ReturnType<typeof useTranslation>["t"]): string {
  return getInstructorBlockingSummary(reasons, t);
}

function getDocumentValue(
  reviewStatus:
    | OnboardingComplianceCertificateRow["reviewStatus"]
    | OnboardingComplianceInsuranceRow["reviewStatus"]
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return getComplianceDocumentValue(reviewStatus, t);
}

function getInsuranceSubtitle(
  row: OnboardingComplianceInsuranceRow | null,
  _locale: string,
  t: ReturnType<typeof useTranslation>["t"],
  options?: {
    countryCode?: string;
  },
): string {
  return getSharedInsuranceSubtitle(row, _locale, t, options ?? {
    countryCode: getStripeMarketDefaults().country,
  });
}

function getCertificateSubtitle(
  row: OnboardingComplianceCertificateRow | null,
  _locale: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return getSharedCertificateSubtitle(row, _locale, t);
}

function getLatestCertificate(
  rows: OnboardingComplianceCertificateRow[],
): OnboardingComplianceCertificateRow | null {
  return getSharedLatestCertificate(rows);
}

function getPreferredInsurancePolicy(
  rows: OnboardingComplianceInsuranceRow[],
  now: number,
): OnboardingComplianceInsuranceRow | null {
  return getSharedPreferredInsurancePolicy(rows, now);
}

export function StepInstructorComplianceBody({
  currentUser,
  diditVerification,
  onboardingCompliance,
  verificationFeedback,
  setVerificationFeedback,
  isUploading,
  openInsuranceUploadPicker,
  openCertificateUploadPicker,
  verificationSports,
  pushToken,
  isRequestingPush,
  requestPushPermission,
  createStripeEmbeddedSession,
  createStripeHostedAccountLink,
  router,
  buildRoleTabRoute,
  ROLE_TAB_ROUTE_NAMES,
  styles,
}: StepInstructorComplianceBodyProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const [stripeConnectVisible, setStripeConnectVisible] = useState(false);

  useEffect(() => {
    if (diditVerification?.isVerified === false) {
      setStripeConnectVisible(true);
    }
  }, [diditVerification?.isVerified]);

  if (
    currentUser?.role !== "instructor" ||
    diditVerification == null ||
    onboardingCompliance == null
  ) {
    return (
      <View style={styles.detailsLoadingStage}>
        <View style={styles.detailsLoadingHeader}>
          <ThemedText type="title">{t("profile.compliance.loading")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {t("onboarding.verification.body")}
          </ThemedText>
        </View>
        <View style={styles.detailsLoadingRow}>
          <ActivityIndicator color={color.primary} />
          <ThemedText style={{ color: color.textMuted }}>
            {t("profile.compliance.loading")}
          </ThemedText>
        </View>
      </View>
    );
  }

  const complianceDetails = onboardingCompliance;
  const diditState = diditVerification;
  const blockersSummary = getBlockingSummary(complianceDetails.summary.blockingReasons, t);
  const preferredInsurance = getPreferredInsurancePolicy(
    complianceDetails.insurancePolicies,
    Date.now(),
  );
  const latestCertificate = getLatestCertificate(complianceDetails.certificates);

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
          {complianceDetails.summary.canApplyToJobs
            ? t("profile.compliance.hero.readyTitle")
            : t("onboarding.verification.subtitle")}
        </ThemedText>
        <ThemedText style={{ color: color.textMuted }}>
          {complianceDetails.summary.canApplyToJobs
            ? t("profile.compliance.hero.readyBody")
            : t("profile.compliance.hero.blockedBody", { blockers: blockersSummary })}
        </ThemedText>
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.verificationCardHeader}>
          <ThemedText type="defaultSemiBold">
            {t("profile.compliance.sections.identity")}
          </ThemedText>
          <IdentityStatusBadge status={diditState.status} />
        </View>
        <ThemedText style={{ color: color.textMuted }}>
          {diditState.isVerified
            ? t("profile.compliance.identity.approved")
            : t("profile.compliance.headline.default")}
        </ThemedText>
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.verificationCardHeader}>
          <ThemedText type="defaultSemiBold">
            {t("profile.compliance.sections.insurance")}
          </ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {getDocumentValue(preferredInsurance?.reviewStatus, t)}
          </ThemedText>
        </View>
        <ThemedText style={{ color: color.textMuted }}>
          {getInsuranceSubtitle(preferredInsurance ?? null, i18n.resolvedLanguage ?? "en", t)}
        </ThemedText>
        <ActionButton
          label={
            complianceDetails.summary.hasApprovedInsurance
              ? t("profile.compliance.actions.replaceInsurance")
              : t("profile.compliance.actions.uploadInsurance")
          }
          fullWidth
          loading={isUploading}
          disabled={isUploading}
          onPress={openInsuranceUploadPicker}
        />
      </View>
      <View style={styles.sectionBlock}>
        <ThemedText type="defaultSemiBold">
          {t("profile.compliance.sections.certificates")}
        </ThemedText>
      </View>
      <View style={styles.verificationCardList}>
        <View
          style={[
            styles.verificationCard,
            { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong },
          ]}
        >
          <View style={styles.verificationCardHeader}>
            <ThemedText type="defaultSemiBold">
              {t("profile.compliance.certificate.title")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {getDocumentValue(latestCertificate?.reviewStatus, t)}
            </ThemedText>
          </View>
          <ThemedText style={{ color: color.textMuted }}>
            {getCertificateSubtitle(latestCertificate ?? null, i18n.resolvedLanguage ?? "en", t)}
          </ThemedText>
          <ActionButton
            label={t("profile.compliance.actions.uploadCertificate")}
            fullWidth
            loading={isUploading}
            disabled={isUploading}
            onPress={openCertificateUploadPicker}
          />
        </View>
        {verificationSports.map((sport) => {
          const certificateRow = getLatestCertificateForSport(
            complianceDetails.certificates,
            sport,
          );
          return (
            <View
              key={sport}
              style={[
                styles.verificationCard,
                { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong },
              ]}
            >
              <View style={styles.verificationCardHeader}>
                <ThemedText type="defaultSemiBold">{toDisplayLabel(sport)}</ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {getDocumentValue(certificateRow?.reviewStatus, t)}
                </ThemedText>
              </View>
              <ThemedText style={{ color: color.textMuted }}>
                {getCertificateSubtitle(certificateRow ?? null, i18n.resolvedLanguage ?? "en", t)}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <View
        style={[
          styles.verificationCard,
          { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong },
        ]}
      >
        <View style={styles.verificationCardHeader}>
          <ThemedText type="defaultSemiBold">{t("onboarding.push.title")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {pushToken ? t("onboarding.push.enabled") : t("profile.compliance.values.pending")}
          </ThemedText>
        </View>
        <ThemedText style={{ color: color.textMuted }}>
          {pushToken
            ? t("onboarding.verification.reviewUpdatesEnabled")
            : t("onboarding.verification.reviewUpdatesDisabled")}
        </ThemedText>
        {!pushToken ? (
          <ActionButton
            disabled={isRequestingPush}
            loading={isRequestingPush}
            label={
              isRequestingPush
                ? t("onboarding.push.requesting")
                : t("onboarding.push.requestPermission")
            }
            tone="secondary"
            fullWidth
            onPress={() => void requestPushPermission()}
          />
        ) : null}
      </View>
      <View style={styles.verifyActions}>
        <ActionButton
          label={
            complianceDetails.summary.canApplyToJobs
              ? t("onboarding.verification.openJobsReady")
              : t("onboarding.verification.openJobsWhileReviewing")
          }
          fullWidth
          onPress={() => router.replace(buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs))}
        />
      </View>

      <StripeConnectEmbeddedModal
        visible={stripeConnectVisible}
        accountStatus="action_required"
        mode="onboarding"
        createEmbeddedSession={createStripeEmbeddedSession}
        createHostedAccountLink={createStripeHostedAccountLink}
        onClose={() => {
          setStripeConnectVisible(false);
        }}
        onCompleted={() => {
          setVerificationFeedback({
            tone: "success",
            message: t("profile.compliance.headline.pending"),
          });
        }}
        onFeedback={setVerificationFeedback}
      />
    </View>
  );
}
