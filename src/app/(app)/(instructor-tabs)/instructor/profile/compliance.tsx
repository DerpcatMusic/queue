import { useAction, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import {
  isComplianceDocumentUploadError,
  useComplianceDocumentUpload,
} from "@/hooks/use-compliance-document-upload";
import { useTheme } from "@/hooks/use-theme";
import { startDiditNativeVerification } from "@/lib/didit-native";
import { Box, Text } from "@/primitives";
import { BorderWidth, Radius } from "@/theme/theme";

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

function formatMachineTag(tag: string) {
  return tag
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVerificationStatusPresentation(
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
  theme: ReturnType<typeof useTheme>,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (status) {
    case "approved":
      return {
        label: t("profile.compliance.values.approved"),
        backgroundColor: theme.color.primarySubtle,
        borderColor: theme.color.primarySubtle,
        textColor: theme.color.primary,
      };
    case "in_review":
    case "pending":
    case "in_progress":
      return {
        label: t("profile.compliance.values.pending"),
        backgroundColor: theme.color.tertiarySubtle,
        borderColor: theme.color.tertiarySubtle,
        textColor: theme.color.tertiary,
      };
    default:
      return {
        label: t("profile.compliance.identity.unverified"),
        backgroundColor: theme.color.tertiarySubtle,
        borderColor: theme.color.tertiarySubtle,
        textColor: theme.color.tertiary,
      };
  }
}

function getDocumentStatusLabel(
  status:
    | ComplianceCertificateRow["reviewStatus"]
    | ComplianceInsuranceRow["reviewStatus"]
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (status) {
    case "approved":
      return t("profile.compliance.values.approved");
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.values.pending");
    case "rejected":
    case "expired":
    case "needs_resubmission":
      return t("profile.compliance.values.reupload");
    default:
      return t("profile.compliance.actions.upload");
  }
}

function VerificationUploadPanel({
  icon,
  label,
  title,
  subtitle,
  statusLabel,
  onPress,
  accentColor,
  disabled = false,
}: {
  icon: "checkmark.circle.fill" | "sparkles";
  label: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  onPress: () => void;
  accentColor: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Box gap="sm">
      <Text variant="bodyStrong">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, title, subtitle].join(". ")}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            borderRadius: Radius.soft,
            borderWidth: BorderWidth.medium,
            borderStyle: "dashed",
            borderColor: theme.color.border,
            backgroundColor: theme.color.surface,
            padding: BrandSpacing.insetRoomy,
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
          },
        ]}
      >
        <Box alignItems="center" gap="md">
          <Box
            width={48}
            height={48}
            alignItems="center"
            justifyContent="center"
            style={{
              borderRadius: Radius.full,
              backgroundColor: theme.color.surfaceAlt,
            }}
          >
            <IconSymbol name={icon} size={22} color={accentColor} />
          </Box>
          <Box alignItems="center" gap="xxs">
            <Text variant="bodyStrong">{title}</Text>
            <Text
              variant="caption"
              color="textMuted"
              style={{ textAlign: "center" }}
            >
              {subtitle}
            </Text>
            <Text
              variant="caption"
              style={{
                color: accentColor,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              {statusLabel}
            </Text>
          </Box>
        </Box>
      </Pressable>
    </Box>
  );
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
  useProfileSubpageSheet({
    title: t("profile.navigation.compliance"),
    routeMatchPath: "/profile/compliance",
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isRefreshingDidit, setIsRefreshingDidit] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
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

  const preferredInsurance = useMemo(
    () => getPreferredInsurancePolicy(compliance?.insurancePolicies ?? [], now),
    [compliance?.insurancePolicies, now],
  );
  const latestCertificate = useMemo(
    () => getLatestCertificate(compliance?.certificates ?? []),
    [compliance?.certificates],
  );
  const approvedCoverage = useMemo(
    () =>
      latestCertificate?.reviewStatus === "approved"
        ? Array.from(
            new Set(
              (
                latestCertificate.coveredSports ??
                (latestCertificate.sport ? [latestCertificate.sport] : [])
              ).map((sport) =>
                isSportType(sport) ? toSportLabel(sport) : sport,
              ),
            ),
          )
        : [],
    [latestCertificate],
  );
  const approvedMachines = useMemo(
    () =>
      latestCertificate?.reviewStatus === "approved"
        ? Array.from(
            new Set(
              (latestCertificate.machineTags ?? []).map(formatMachineTag),
            ),
          )
        : [],
    [latestCertificate],
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
      const session = await createSessionForCurrentInstructor({});
      const result = await startDiditNativeVerification({
        sessionToken: session.sessionToken,
        locale,
      });

      if (result.outcome !== "cancelled") {
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
    isRefreshingDidit,
    isStartingDidit,
    locale,
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
  const diditStatusPresentation = getVerificationStatusPresentation(
    diditVerification.status,
    theme,
    t,
  );
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
      contentContainerStyle={{
        gap: BrandSpacing.xl,
        paddingHorizontal: BrandSpacing.inset,
      }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
    >
      {feedback ? (
        <NoticeBanner
          tone={feedback.tone}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      <KitSurface
        tone="base"
        padding={BrandSpacing.insetRoomy}
        gap={BrandSpacing.stackRoomy}
        style={{
          borderRadius: Radius.soft,
          borderWidth: BorderWidth.medium,
          borderColor: theme.color.border,
          backgroundColor: theme.color.surfaceAlt,
        }}
      >
        <Text variant="radarLabel" color="textMuted">
          {t("profile.compliance.hero.missionLabel")}
        </Text>
        <Box flexDirection="row" alignItems="center" gap="md">
          <Box
            width={56}
            height={56}
            alignItems="center"
            justifyContent="center"
            style={{
              borderRadius: Radius.lg,
              backgroundColor: theme.color.surface,
              borderWidth: BorderWidth.medium,
              borderColor: theme.color.tertiarySubtle,
            }}
          >
            <IconSymbol
              name="person.fill"
              size={20}
              color={theme.color.tertiary}
            />
          </Box>
          <Box flex={1} minWidth={0} gap="xxs">
            <Text variant="titleLarge">
              {currentUser.fullName ?? t("profile.account.fallbackName")}
            </Text>
            <Box
              alignSelf="flex-start"
              px="md"
              py="xs"
              style={{
                borderRadius: Radius.full,
                backgroundColor: diditStatusPresentation.backgroundColor,
                borderWidth: BorderWidth.thin,
                borderColor: diditStatusPresentation.borderColor,
              }}
            >
              <Text
                variant="caption"
                style={{
                  color: diditStatusPresentation.textColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                }}
              >
                {diditStatusPresentation.label}
              </Text>
            </Box>
          </Box>
        </Box>

        <Box gap="xs">
          <Text variant="bodyStrong">
            {t("profile.compliance.identity.cardTitle")}
          </Text>
          <Text variant="caption" color="textMuted">
            {t("profile.compliance.identity.cardBody")}
          </Text>
        </Box>

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

        <Text
          variant="caption"
          color="textMuted"
          style={{ textAlign: "center" }}
        >
          {t("profile.compliance.identity.cardHint")}
        </Text>
      </KitSurface>

      <Box gap="sm">
        <Text variant="radarLabel" color="textMuted">
          {t("profile.compliance.documents.title")}
        </Text>
        <VerificationUploadPanel
          icon="checkmark.circle.fill"
          label={t("profile.compliance.insurance.title")}
          title={t("profile.compliance.documents.tapToUpload")}
          subtitle={getInsuranceSubtitle(preferredInsurance ?? null, locale, t)}
          statusLabel={getDocumentStatusLabel(
            preferredInsurance?.reviewStatus,
            t,
          )}
          onPress={onOpenInsuranceUpload}
          accentColor={theme.color.tertiary}
          disabled={isUploading}
        />
        <VerificationUploadPanel
          icon="sparkles"
          label={t("profile.compliance.certificate.title")}
          title={t("profile.compliance.documents.tapToUpload")}
          subtitle={getCertificateSubtitle(
            latestCertificate ?? null,
            locale,
            t,
          )}
          statusLabel={getDocumentStatusLabel(
            latestCertificate?.reviewStatus,
            t,
          )}
          onPress={onOpenCertificateUpload}
          accentColor={theme.color.tertiary}
          disabled={isUploading}
        />

        <KitSurface
          tone="sunken"
          padding={BrandSpacing.lg}
          gap={BrandSpacing.sm}
          style={{
            borderRadius: Radius.cardSubtle,
            borderWidth: BorderWidth.thin,
            borderColor: theme.color.border,
            backgroundColor: theme.color.surface,
          }}
        >
          <Text variant="caption" color="textMuted">
            {latestCertificate?.reviewStatus === "approved"
              ? t("profile.compliance.certificate.coverageTitle")
              : t("profile.compliance.certificate.coveragePending")}
          </Text>
          {approvedCoverage.length > 0 ? (
            <Box gap="sm">
              <Text variant="bodyMedium">
                {t("profile.compliance.certificate.coverageSports")}
              </Text>
              <Box flexDirection="row" flexWrap="wrap" gap="sm">
                {approvedCoverage.map((label) => (
                  <Box
                    key={label}
                    px="md"
                    py="xs"
                    backgroundColor="primarySubtle"
                    borderColor="primarySubtle"
                    borderRadius={Radius.pill}
                    borderWidth={BorderWidth.thin}
                  >
                    <Text variant="caption" color="primary">
                      {label}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
          {approvedMachines.length > 0 ? (
            <Box gap="sm">
              <Text variant="bodyMedium">
                {t("profile.compliance.certificate.coverageMachines")}
              </Text>
              <Box flexDirection="row" flexWrap="wrap" gap="sm">
                {approvedMachines.map((label) => (
                  <Box
                    key={label}
                    px="md"
                    py="xs"
                    backgroundColor="surfaceAlt"
                    borderColor="border"
                    borderRadius={Radius.pill}
                    borderWidth={BorderWidth.thin}
                  >
                    <Text variant="caption" color="text">
                      {label}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
        </KitSurface>

        <KitSurface
          tone="sunken"
          padding={BrandSpacing.lg}
          gap={BrandSpacing.xs}
          style={{
            borderRadius: Radius.cardSubtle,
            borderWidth: BorderWidth.thin,
            borderColor: theme.color.border,
            backgroundColor: theme.color.surface,
          }}
        >
          <Text variant="caption" color="textMuted">
            {t("profile.compliance.documents.reviewNote")}
          </Text>
        </KitSurface>
      </Box>
    </ProfileSubpageScrollView>
  );
}
