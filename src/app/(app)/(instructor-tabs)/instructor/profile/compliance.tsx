import { useAction, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, RefreshControl, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ProfileSubpageScrollView } from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import {
  isComplianceDocumentUploadError,
  useComplianceDocumentUpload,
} from "@/hooks/use-compliance-document-upload";
import { useTheme } from "@/hooks/use-theme";

type ComplianceCertificateRow = {
  sport?: string;
  coveredSports?: string[];
  machineTags?: string[];
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

type ComplianceInsuranceRow = {
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

function formatDate(value: number | undefined, locale: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getLatestCertificateForSport(
  rows: ComplianceCertificateRow[],
  sport: string,
) {
  const matchingRows = rows.filter((row) => {
    const coveredSports =
      row.coveredSports && row.coveredSports.length > 0
        ? row.coveredSports
        : row.sport
          ? [row.sport]
          : [];
    return coveredSports.includes(sport);
  });
  if (matchingRows.length === 0) {
    return null;
  }

  return [...matchingRows].sort((left, right) => {
    const leftPriority = left.reviewStatus === "approved" ? 1 : 0;
    const rightPriority = right.reviewStatus === "approved" ? 1 : 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    return (
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt)
    );
  })[0];
}

function getLatestCertificate(rows: ComplianceCertificateRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort(
    (left, right) =>
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt),
  )[0];
}

function getPreferredInsurancePolicy(
  rows: ComplianceInsuranceRow[],
  now: number,
) {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const leftActiveApproved =
      left.reviewStatus === "approved" &&
      (!left.expiresAt || left.expiresAt > now)
        ? 1
        : 0;
    const rightActiveApproved =
      right.reviewStatus === "approved" &&
      (!right.expiresAt || right.expiresAt > now)
        ? 1
        : 0;
    if (leftActiveApproved !== rightActiveApproved) {
      return rightActiveApproved - leftActiveApproved;
    }
    return (
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt)
    );
  })[0];
}

function getCertificateSubtitle(
  row: ComplianceCertificateRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!row) {
    return t("profile.compliance.certificate.missingBody");
  }

  const reviewedAt = formatDate(row.reviewedAt, locale);
  const coverage = (row.coveredSports ?? (row.sport ? [row.sport] : []))
    .map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport))
    .join(", ");
  switch (row.reviewStatus) {
    case "approved": {
      const source = [row.certificateTitle, row.issuerName]
        .filter(Boolean)
        .join(" · ");
      const summary = [coverage, source].filter(Boolean).join(" · ");
      if (summary) {
        return reviewedAt
          ? t("profile.compliance.certificate.approvedWithSourceAndDate", {
              source: summary,
              date: reviewedAt,
            })
          : t("profile.compliance.certificate.approvedWithSource", {
              source: summary,
            });
      }
      return reviewedAt
        ? t("profile.compliance.certificate.approvedWithDate", {
            date: reviewedAt,
          })
        : t("profile.compliance.certificate.approvedBody");
    }
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.certificate.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.certificate.reuploadBody");
    default:
      return t("profile.compliance.certificate.missingBody");
  }
}

function getInsuranceSubtitle(
  row: ComplianceInsuranceRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!row) {
    return t("profile.compliance.insurance.missingBody");
  }

  const expiresLabel = formatDate(row.expiresAt, locale);
  switch (row.reviewStatus) {
    case "approved":
      return expiresLabel
        ? t("profile.compliance.insurance.approvedWithDate", {
            date: expiresLabel,
          })
        : t("profile.compliance.insurance.approvedBody");
    case "expired":
      return expiresLabel
        ? t("profile.compliance.insurance.expiredWithDate", {
            date: expiresLabel,
          })
        : t("profile.compliance.insurance.expiredBody");
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.insurance.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.insurance.reuploadBody");
    default:
      return t("profile.compliance.insurance.missingBody");
  }
}

function getBlockingSummary(
  reasons: string[],
  t: ReturnType<typeof useTranslation>["t"],
) {
  const labels = reasons.map((reason) => {
    switch (reason) {
      case "identity_verification_required":
        return t("profile.compliance.blockers.identity");
      case "insurance_verification_required":
        return t("profile.compliance.blockers.insurance");
      case "sport_certificate_required":
        return t("profile.compliance.blockers.certificate");
      default:
        return reason;
    }
  });
  return labels.join(" · ");
}

function getDiditActionLabel(
  status:
    | "approved"
    | "declined"
    | "in_review"
    | "pending"
    | "in_progress"
    | "abandoned"
    | "expired"
    | "not_started"
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (status) {
    case "approved":
      return t("profile.compliance.actions.refreshIdentity");
    case "in_review":
    case "pending":
    case "in_progress":
      return t("profile.identityVerification.checkStatus");
    default:
      return t("profile.compliance.actions.startIdentity");
  }
}

export default function InstructorComplianceScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isRefreshingDidit, setIsRefreshingDidit] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  const currentUser = useQuery(api.users.getCurrentUser);
  const complianceArgs =
    currentUser?.role === "instructor"
      ? refreshNonce > 0
        ? { now: Date.now() }
        : {}
      : "skip";
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const compliance = useQuery(
    api.compliance.getMyInstructorComplianceDetails,
    complianceArgs,
  );
  const createSessionForCurrentInstructor = useAction(
    api.didit.createSessionForCurrentInstructor,
  );
  const refreshMyDiditVerification = useAction(
    api.didit.refreshMyDiditVerification,
  );
  const { isUploading, pickAndUploadComplianceDocument } =
    useComplianceDocumentUpload();

  const locale = i18n.resolvedLanguage ?? "en";
  const now = Date.now();
  const diditReturnUrl = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: "queue://didit/return",
        scheme: "queue",
        path: "didit/return",
      }),
    [],
  );

  const sports = useMemo<string[]>(
    () => [...new Set(instructorSettings?.sports ?? [])].sort(),
    [instructorSettings?.sports],
  );
  const preferredInsurance = useMemo(
    () => getPreferredInsurancePolicy(compliance?.insurancePolicies ?? [], now),
    [compliance?.insurancePolicies, now],
  );
  const latestCertificate = useMemo(
    () => getLatestCertificate(compliance?.certificates ?? []),
    [compliance?.certificates],
  );

  const refreshDiditStatus = useCallback(async () => {
    setIsRefreshingDidit(true);
    try {
      const latest = await refreshMyDiditVerification({});
      setFeedback({
        tone: "success",
        message: latest.isVerified
          ? t("profile.compliance.feedback.identityApproved")
          : t("profile.compliance.feedback.identityRefreshStarted"),
      });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : t("profile.compliance.errors.identityStartFailed"),
      });
    } finally {
      setIsRefreshingDidit(false);
    }
  }, [refreshMyDiditVerification, t]);

  const startDiditVerification = useCallback(async () => {
    if (isStartingDidit || isRefreshingDidit) {
      return;
    }

    setIsStartingDidit(true);
    try {
      const session = await createSessionForCurrentInstructor({
        callback: diditReturnUrl,
      });
      const browserResult = await WebBrowser.openAuthSessionAsync(
        session.verificationUrl,
        diditReturnUrl,
      );

      if (browserResult.type === "success") {
        await refreshDiditStatus();
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : t("profile.compliance.errors.identityStartFailed"),
      });
    } finally {
      setIsStartingDidit(false);
    }
  }, [
    createSessionForCurrentInstructor,
    diditReturnUrl,
    isRefreshingDidit,
    isStartingDidit,
    refreshDiditStatus,
    t,
  ]);

  const uploadInsurance = useCallback(
    async (source: "document" | "image") => {
      try {
        const result = await pickAndUploadComplianceDocument({
          kind: "insurance",
          source,
        });
        if (!result) {
          return;
        }
        setFeedback({
          tone: "success",
          message: t("profile.compliance.feedback.insuranceUploaded"),
        });
        setRefreshNonce((value) => value + 1);
      } catch (error) {
        const message = isComplianceDocumentUploadError(error)
          ? error.message
          : t("profile.compliance.errors.uploadFailed");
        setFeedback({ tone: "error", message });
      }
    },
    [pickAndUploadComplianceDocument, t],
  );

  const uploadCertificate = useCallback(
    async (source: "document" | "image") => {
      try {
        const result = await pickAndUploadComplianceDocument({
          kind: "certificate",
          source,
        });
        if (!result) {
          return;
        }
        setFeedback({
          tone: "success",
          message: t("profile.compliance.feedback.certificateUploaded"),
        });
        setRefreshNonce((value) => value + 1);
      } catch (error) {
        const message = isComplianceDocumentUploadError(error)
          ? error.message
          : t("profile.compliance.errors.uploadFailed");
        setFeedback({ tone: "error", message });
      }
    },
    [pickAndUploadComplianceDocument, t],
  );

  const onOpenInsuranceUpload = useCallback(() => {
    Alert.alert(
      t("profile.compliance.uploadPicker.title"),
      t("profile.compliance.uploadPicker.body"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("profile.compliance.actions.usePhoto"),
          onPress: () => {
            void uploadInsurance("image");
          },
        },
        {
          text: t("profile.compliance.actions.useFile"),
          onPress: () => {
            void uploadInsurance("document");
          },
        },
      ],
    );
  }, [t, uploadInsurance]);

  const onOpenCertificateUpload = useCallback(() => {
    Alert.alert(
      t("profile.compliance.certificate.uploadTitle"),
      t("profile.compliance.uploadPicker.body"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("profile.compliance.actions.usePhoto"),
          onPress: () => {
            void uploadCertificate("image");
          },
        },
        {
          text: t("profile.compliance.actions.useFile"),
          onPress: () => {
            void uploadCertificate("document");
          },
        },
      ],
    );
  }, [t, uploadCertificate]);

  if (
    currentUser === undefined ||
    (currentUser?.role === "instructor" &&
      (instructorSettings === undefined ||
        compliance === undefined ||
        diditVerification === undefined))
  ) {
    return <LoadingScreen label={t("profile.compliance.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (
    currentUser.role !== "instructor" ||
    !instructorSettings ||
    !compliance ||
    !diditVerification
  ) {
    return <Redirect href="/" />;
  }

  const blockersSummary = getBlockingSummary(
    compliance.summary.blockingReasons,
    t,
  );
  const isDiditBusy = isStartingDidit || isRefreshingDidit;
  const diditActionLabel = getDiditActionLabel(diditVerification.status, t);
  const diditButtonColors = diditVerification.isVerified
    ? undefined
    : {
        backgroundColor: theme.color.tertiary,
        pressedBackgroundColor: theme.color.tertiary,
        disabledBackgroundColor: theme.color.tertiarySubtle,
        labelColor: theme.color.onPrimary,
        disabledLabelColor: theme.color.onPrimary,
        nativeTintColor: theme.color.tertiary,
      };
  const handleDiditAction = () => {
    if (
      diditVerification.status === "in_progress" ||
      diditVerification.status === "pending" ||
      diditVerification.status === "in_review"
    ) {
      void refreshDiditStatus();
      return;
    }
    if (diditVerification.isVerified) {
      void refreshDiditStatus();
      return;
    }
    void startDiditVerification();
  };

  return (
    <ProfileSubpageScrollView
      routeKey="instructor/profile/compliance"
      style={{ flex: 1, backgroundColor: theme.color.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.xl }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            setRefreshNonce((value) => value + 1);
          }}
          tintColor={theme.color.tertiary}
        />
      }
    >
      <View
        style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.xl }}
      >
        {feedback ? (
          <NoticeBanner
            tone={feedback.tone}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        <View style={{ gap: BrandSpacing.sm }}>
          <ThemedText selectable style={BrandType.title}>
            {compliance.summary.canApplyToJobs
              ? t("profile.compliance.hero.readyTitle")
              : t("profile.compliance.hero.blockedTitle")}
          </ThemedText>
          <ThemedText
            selectable
            type="caption"
            style={{ color: theme.color.textMuted }}
          >
            {compliance.summary.canApplyToJobs
              ? t("profile.compliance.hero.readyBody")
              : t("profile.compliance.hero.blockedBody", {
                  blockers: blockersSummary,
                })}
          </ThemedText>
        </View>

        {!diditVerification.isVerified ? (
          <ActionButton
            label={t("profile.compliance.actions.startIdentity")}
            onPress={handleDiditAction}
            fullWidth
            loading={isDiditBusy}
            disabled={isDiditBusy}
            {...(diditButtonColors ? { colors: diditButtonColors } : {})}
          />
        ) : null}

        <View>
          <ProfileSectionHeader
            label={t("profile.compliance.sections.identity")}
            icon="checkmark.shield.fill"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <ProfileSettingRow
              title={t("profile.compliance.identity.title")}
              subtitle={
                diditVerification.isVerified
                  ? t("profile.compliance.identity.approved")
                  : t("profile.compliance.identity.required")
              }
              value={
                diditVerification.isVerified
                  ? t("profile.compliance.values.approved")
                  : t("profile.compliance.values.actionRequired")
              }
              icon="person.text.rectangle.fill"
            />
          </ProfileSectionCard>
          <View style={{ paddingTop: BrandSpacing.md }}>
            <ActionButton
              label={diditActionLabel}
              onPress={handleDiditAction}
              fullWidth
              loading={isDiditBusy}
              disabled={isDiditBusy}
              {...(diditButtonColors ? { colors: diditButtonColors } : {})}
              {...(diditVerification.isVerified
                ? { tone: "secondary" as const }
                : {})}
            />
          </View>
        </View>

        <View>
          <ProfileSectionHeader
            label={t("profile.compliance.sections.insurance")}
            icon="shield.lefthalf.filled"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <ProfileSettingRow
              title={t("profile.compliance.insurance.title")}
              subtitle={getInsuranceSubtitle(
                preferredInsurance ?? null,
                locale,
                t,
              )}
              value={
                compliance.summary.hasApprovedInsurance
                  ? t("profile.compliance.values.approved")
                  : t("profile.compliance.actions.upload")
              }
              icon="checkmark.shield.fill"
              {...(!compliance.summary.hasApprovedInsurance
                ? { onPress: onOpenInsuranceUpload }
                : {})}
            />
          </ProfileSectionCard>
          <View style={{ paddingTop: BrandSpacing.md }}>
            <ActionButton
              label={
                compliance.summary.hasApprovedInsurance
                  ? t("profile.compliance.actions.replaceInsurance")
                  : t("profile.compliance.actions.uploadInsurance")
              }
              onPress={onOpenInsuranceUpload}
              fullWidth
              loading={isUploading}
              disabled={isUploading}
            />
          </View>
        </View>

        <View>
          <ProfileSectionHeader
            label={t("profile.compliance.sections.certificates")}
            icon="rosette"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <ProfileSettingRow
              title={t("profile.compliance.certificate.title")}
              subtitle={getCertificateSubtitle(
                latestCertificate ?? null,
                locale,
                t,
              )}
              value={
                latestCertificate?.reviewStatus === "approved"
                  ? t("profile.compliance.values.approved")
                  : latestCertificate &&
                      latestCertificate.reviewStatus !== "rejected" &&
                      latestCertificate.reviewStatus !== "needs_resubmission"
                    ? t("profile.compliance.values.pending")
                    : t("profile.compliance.actions.upload")
              }
              icon="rosette"
              onPress={onOpenCertificateUpload}
              {...(sports.length > 0 ? { showDivider: true } : {})}
            />
            {sports.length > 0
              ? sports.map((sport, index) => {
                  const certificateRow = getLatestCertificateForSport(
                    compliance.certificates,
                    sport,
                  );

                  return (
                    <ProfileSettingRow
                      key={sport}
                      title={isSportType(sport) ? toSportLabel(sport) : sport}
                      subtitle={getCertificateSubtitle(
                        certificateRow ?? null,
                        locale,
                        t,
                      )}
                      value={
                        certificateRow?.reviewStatus === "approved"
                          ? t("profile.compliance.values.approved")
                          : certificateRow &&
                              certificateRow.reviewStatus !== "rejected" &&
                              certificateRow.reviewStatus !==
                                "needs_resubmission"
                            ? t("profile.compliance.values.pending")
                            : t("profile.compliance.values.actionRequired")
                      }
                      icon="rosette"
                      {...(index < sports.length - 1
                        ? { showDivider: true }
                        : {})}
                    />
                  );
                })
              : null}
          </ProfileSectionCard>
          <View style={{ paddingTop: BrandSpacing.md }}>
            <ActionButton
              label={t("profile.compliance.actions.uploadCertificate")}
              onPress={onOpenCertificateUpload}
              fullWidth
              loading={isUploading}
              disabled={isUploading}
            />
          </View>
        </View>
      </View>
    </ProfileSubpageScrollView>
  );
}
