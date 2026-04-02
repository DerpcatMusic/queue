import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, type AppStateStatus, Pressable } from "react-native";
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
import { isSportType, toCapabilityTagLabel, toSportLabel } from "@/convex/constants";
import {
  getCertificateSubtitle as getSharedCertificateSubtitle,
  getComplianceDocumentValue,
  getLatestCertificate as getSharedLatestCertificate,
  getInsuranceSubtitle as getSharedInsuranceSubtitle,
  getPreferredInsurancePolicy as getSharedPreferredInsurancePolicy,
} from "@/features/compliance/compliance-ui";
import {
  getDiditActionButtonColors,
  getDiditPrimaryActionLabel,
  getDiditVerificationStatusPresentation,
  shouldAutoRefreshDiditStatus,
  shouldOfferDiditManualRefresh,
} from "@/features/compliance/didit-ui";
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

function getLatestCertificate(rows: ComplianceCertificateRow[]) {
  return getSharedLatestCertificate(rows);
}

function getPreferredInsurancePolicy(rows: ComplianceInsuranceRow[], now: number) {
  return getSharedPreferredInsurancePolicy(rows, now);
}

function getCertificateSubtitle(
  row: ComplianceCertificateRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  return getSharedCertificateSubtitle(row, locale, t);
}

function getInsuranceSubtitle(
  row: ComplianceInsuranceRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  return getSharedInsuranceSubtitle(row, locale, t);
}

function getDocumentStatusLabel(
  status:
    | ComplianceCertificateRow["reviewStatus"]
    | ComplianceInsuranceRow["reviewStatus"]
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  return getComplianceDocumentValue(status, t);
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
            <Text variant="caption" color="textMuted" style={{ textAlign: "center" }}>
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const currentUser = useQuery(api.users.getCurrentUser);
  const complianceArgs =
    currentUser?.role === "instructor" ? (refreshNonce > 0 ? { now: Date.now() } : {}) : "skip";
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const accessSnapshot = useQuery(
    api.access.getMyInstructorAccessSnapshot,
    currentUser?.role === "instructor" ? complianceArgs : "skip",
  );
  const diditVerification = accessSnapshot?.verification;
  const compliance = accessSnapshot?.compliance;
  const createSessionForCurrentInstructor = useAction(api.didit.createSessionForCurrentInstructor);
  const refreshMyDiditVerification = useAction(api.didit.refreshMyDiditVerification);
  const markMyDiditVerificationAbandoned = useMutation(
    api.didit.markMyDiditVerificationAbandoned,
  );
  const { isUploading, pickAndUploadComplianceDocument } = useComplianceDocumentUpload();

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
                latestCertificate.specialties?.map((specialty) => specialty.sport) ??
                (latestCertificate.sport ? [latestCertificate.sport] : [])
              ).map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)),
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
              (
                latestCertificate.specialties?.flatMap(
                  (specialty) => specialty.capabilityTags ?? [],
                ) ?? []
              ).map((tag) => toCapabilityTagLabel(tag)),
            ),
          )
        : [],
    [latestCertificate],
  );

  const refreshDiditStatus = useCallback(async (options?: { silent?: boolean }) => {
    setIsRefreshingDidit(true);
    try {
      const latest = await refreshMyDiditVerification({});
      if (!options?.silent) {
        setFeedback({
          tone: "success",
          message: latest.isVerified
            ? t("profile.compliance.feedback.identityApproved")
            : t("profile.compliance.feedback.identityRefreshStarted"),
        });
      }
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      if (!options?.silent) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : t("profile.compliance.errors.identityStartFailed"),
        });
      }
    } finally {
      setIsRefreshingDidit(false);
    }
  }, [refreshMyDiditVerification, t]);

  useEffect(() => {
    if (
      !shouldAutoRefreshDiditStatus(
        diditVerification?.status,
        diditVerification?.isVerified ?? false,
        diditVerification?.sessionId,
      )
    ) {
      return;
    }

    void refreshDiditStatus({ silent: true });

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInactive =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = nextState;
      if (nextState === "active" && wasInactive) {
        void refreshDiditStatus({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    diditVerification?.isVerified,
    diditVerification?.sessionId,
    diditVerification?.status,
    refreshDiditStatus,
  ]);

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

      if (result.outcome === "cancelled") {
        await markMyDiditVerificationAbandoned({});
        setRefreshNonce((value) => value + 1);
      } else {
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
    markMyDiditVerificationAbandoned,
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
  const diditActionLabel = getDiditPrimaryActionLabel(
    diditVerification.isVerified,
    t,
  );
  const diditButtonColors = getDiditActionButtonColors(
    diditVerification.isVerified,
    theme.color,
  );
  const diditStatusPresentation = getDiditVerificationStatusPresentation(
    diditVerification.status,
    theme.color,
    t,
  );
  const showDiditManualRefresh = shouldOfferDiditManualRefresh(
    diditVerification.status,
    diditVerification.isVerified,
  );
  const handleDiditAction = () => {
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
            <IconSymbol name="person.fill" size={20} color={theme.color.tertiary} />
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
          <Text variant="bodyStrong">{t("profile.compliance.identity.title")}</Text>
          <Text variant="caption" color="textMuted">
            {diditVerification.isVerified
              ? t("profile.compliance.identity.approved")
              : t("profile.compliance.identity.required")}
          </Text>
          {!diditVerification.isVerified ? (
            <Text variant="caption" color="textMuted">
              {t("profile.studioCompliance.identity.requiredBody", {
                status: diditStatusPresentation.label,
              })}
            </Text>
          ) : null}
        </Box>

        <Box gap="sm">
          <ActionButton
            label={diditActionLabel}
            onPress={handleDiditAction}
            fullWidth
            loading={isStartingDidit}
            disabled={isDiditBusy}
            native={false}
            {...(diditButtonColors ? { colors: diditButtonColors } : {})}
            {...(diditVerification.isVerified ? { tone: "secondary" as const } : {})}
            labelStyle={{
              textTransform: "uppercase",
              letterSpacing: 0.8,
              fontWeight: "700",
            }}
          />
          {showDiditManualRefresh ? (
            <ActionButton
              label={t("profile.identityVerification.checkStatus")}
              onPress={() => {
                void refreshDiditStatus();
              }}
              fullWidth
              tone="secondary"
              loading={isRefreshingDidit}
              disabled={isDiditBusy}
              native={false}
              labelStyle={{
                textTransform: "uppercase",
                letterSpacing: 0.8,
                fontWeight: "700",
              }}
            />
          ) : null}
        </Box>
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
          statusLabel={getDocumentStatusLabel(preferredInsurance?.reviewStatus, t)}
          onPress={onOpenInsuranceUpload}
          accentColor={theme.color.tertiary}
          disabled={isUploading}
        />
        <VerificationUploadPanel
          icon="sparkles"
          label={t("profile.compliance.certificate.title")}
          title={t("profile.compliance.documents.tapToUpload")}
          subtitle={getCertificateSubtitle(latestCertificate ?? null, locale, t)}
          statusLabel={getDocumentStatusLabel(latestCertificate?.reviewStatus, t)}
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
              <Text variant="bodyMedium">{t("profile.compliance.certificate.coverageSports")}</Text>
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
