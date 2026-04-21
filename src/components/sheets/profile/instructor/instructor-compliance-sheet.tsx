/**
 * Instructor Compliance Sheet - displays compliance/verification content in a bottom sheet.
 */

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, AppState, type AppStateStatus, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { isSportType, toCapabilityTagLabel, toSportLabel } from "@/convex/constants";
import {
  getComplianceDocumentValue,
  getCertificateSubtitle as getSharedCertificateSubtitle,
  getInsuranceSubtitle as getSharedInsuranceSubtitle,
  getLatestCertificate as getSharedLatestCertificate,
  getPreferredInsurancePolicy as getSharedPreferredInsurancePolicy,
} from "@/features/compliance/compliance-ui";
import {
  getIdentityActionButtonColors,
  getIdentityPrimaryActionLabel,
  getIdentityVerificationStatusPresentation,
  shouldAutoRefreshIdentityStatus,
} from "@/features/compliance/identity-verification-ui";
import {
  isComplianceDocumentUploadError,
  useComplianceDocumentUpload,
} from "@/hooks/use-compliance-document-upload";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { getStripeMarketDefaults } from "@/lib/stripe";
import { Box, HStack, Spacer, Text, VStack } from "@/primitives";
import { BorderWidth, LetterSpacing, Motion, Radius } from "@/theme/theme";

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
  options?: {
    countryCode?: string;
  },
) {
  return getSharedInsuranceSubtitle(row, locale, t, options);
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

// ============================================================
// Skeleton - matches real compliance screen layout
// ============================================================

function SkeletonProfile() {
  const { color: theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <VStack gap="xl" style={{ padding: BrandSpacing.lg }}>
        {/* Identity verification card */}
        <Box p="lg" style={{ backgroundColor: theme.surfaceMuted, borderRadius: BrandRadius.soft }}>
          <HStack gap="md" align="center">
            <SkeletonLine width={48} height={48} radius={BrandRadius.lg} />
            <VStack gap="xs" style={{ flex: 1 }}>
              <SkeletonLine width="50%" height={16} />
              <SkeletonLine width="30%" height={12} />
            </VStack>
          </HStack>
          <Spacer size="lg" />
          <SkeletonLine width="100%" height={44} radius={BrandRadius.button} />
        </Box>

        {/* Document upload sections */}
        <VStack gap="lg">
          <Box
            p="lg"
            style={{ backgroundColor: theme.surfaceElevated, borderRadius: BrandRadius.cardSubtle }}
          >
            <SkeletonLine width="40%" height={14} />
            <Spacer size="md" />
            <SkeletonLine width="100%" height={80} radius={BrandRadius.soft} />
          </Box>
          <Box
            p="lg"
            style={{ backgroundColor: theme.surfaceElevated, borderRadius: BrandRadius.cardSubtle }}
          >
            <SkeletonLine width="40%" height={14} />
            <Spacer size="md" />
            <SkeletonLine width="100%" height={80} radius={BrandRadius.soft} />
          </Box>
        </VStack>
      </VStack>
    </Animated.View>
  );
}

function VerificationUploadPanel({
  icon,
  label,
  subtitle,
  statusLabel,
  reviewStatus,
  onPress,
  accentColor,
  disabled = false,
}: {
  icon: "checkmark.circle.fill" | "sparkles";
  label: string;
  subtitle: string;
  statusLabel: string;
  reviewStatus: ComplianceCertificateRow["reviewStatus"] | ComplianceInsuranceRow["reviewStatus"] | undefined;
  onPress: () => void;
  accentColor: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const isReviewing =
    reviewStatus === "uploaded" || reviewStatus === "ai_pending" || reviewStatus === "ai_reviewing";
  const isFailed =
    reviewStatus === "rejected" || reviewStatus === "needs_resubmission" || reviewStatus === "expired";
  const isMissing = reviewStatus === undefined;
  const displayStatusLabel = isReviewing ? "Verifying…" : statusLabel;
  const statusTone = reviewStatus === "approved" ? theme.color.success : isFailed || isMissing ? theme.color.danger : accentColor;

  return (
    <Box gap="sm">
      <Text variant="bodyStrong">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, subtitle, displayStatusLabel].join(". ")}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            borderRadius: Radius.soft,
            borderWidth: BorderWidth.medium,
            borderStyle: "dashed",
            borderColor: theme.color.border,
            backgroundColor: theme.color.surfaceElevated,
            padding: BrandSpacing.insetRoomy,
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
          },
        ]}
      >
        <Box flexDirection="row" alignItems="center" gap="md">
          <Box
            width={48}
            height={48}
            alignItems="center"
            justifyContent="center"
            style={{
              borderRadius: Radius.full,
              backgroundColor: theme.color.surfaceMuted,
            }}
          >
            <IconSymbol name={icon} size={22} color={accentColor} />
          </Box>
          <Box flex={1} minWidth={0} gap="xxs">
            <Text variant="caption" color="textMuted">
              {subtitle}
            </Text>
            <Text
              variant="caption"
              style={{
                color: statusTone,
                textTransform: "uppercase",
                letterSpacing: LetterSpacing.trackingWide,
              }}
            >
              {displayStatusLabel}
            </Text>
          </Box>
          {isReviewing ? (
            <ActivityIndicator size="small" color={statusTone} />
          ) : isFailed ? (
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={theme.color.danger} />
          ) : reviewStatus === "approved" ? (
            <IconSymbol name="checkmark.circle.fill" size={18} color={theme.color.success} />
          ) : (
            <IconSymbol name="chevron.right" size={18} color={theme.color.textMuted} />
          )}
        </Box>
      </Pressable>
    </Box>
  );
}

interface InstructorComplianceSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorComplianceSheet({ visible, onClose }: InstructorComplianceSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [refreshAt, setRefreshAt] = useState<number | null>(null);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isRefreshingDidit, setIsRefreshingDidit] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const autoRefreshSessionIdRef = useRef<string | null>(null);
  const didAutoCloseStripeRef = useRef(false);
  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);
  const currentUserLabel =
    currentUser?.fullName ?? currentUser?.email ?? t("profile.roles.instructor");
  const complianceArgs = useMemo(
    () => (currentUser?.role === "instructor" ? (refreshAt ? { now: refreshAt } : {}) : "skip"),
    [currentUser?.role, refreshAt],
  );
  const instructorSettings = useQuery(
    api.instructors.settings.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const accessSnapshot = useQuery(
    api.access.snapshots.getMyInstructorAccessSnapshot,
    currentUser?.role === "instructor" ? complianceArgs : "skip",
  );
  const diditVerification = accessSnapshot?.verification;
  const compliance = accessSnapshot?.compliance;
  const refreshMyDiditVerification = useAction(
    api.payments.actions.refreshMyInstructorStripeConnectedAccount,
  );
  const createStripeEmbeddedSession = useAction(
    api.payments.actions.createMyInstructorStripeEmbeddedSession,
  );
  const createStripeHostedAccountLink = useAction(
    api.payments.actions.createMyInstructorStripeAccountLink,
  );
  const { isUploading, pickAndUploadComplianceDocument } = useComplianceDocumentUpload();

  const locale = i18n.resolvedLanguage ?? "en";
  const now = Date.now();
  const [stripeKycVisible, setStripeKycVisible] = useState(false);

  const preferredInsurance = useMemo(
    () => getPreferredInsurancePolicy(compliance?.insurancePolicies ?? [], now),
    [compliance?.insurancePolicies, now],
  );
  const marketCountry = getStripeMarketDefaults().country;
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

  const refreshDiditStatus = useCallback(
    async (options?: { silent?: boolean }) => {
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
        setRefreshAt(Date.now());
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
    },
    [refreshMyDiditVerification, t],
  );

  const handleStripeKycFeedback = useCallback(
    (feedback: { tone: "success" | "error"; message: string } | null) => {
      setFeedback(feedback);
    },
    [],
  );

  const handleStripeKycCompleted = useCallback(async () => {
    await refreshDiditStatus();
    setIsStartingDidit(false);
    setStripeKycVisible(false);
  }, [refreshDiditStatus]);

  const handleCreateStripeEmbeddedSession = useCallback(
    async () => createStripeEmbeddedSession({}),
    [createStripeEmbeddedSession],
  );

  const handleCreateStripeHostedAccountLink = useCallback(
    async () => createStripeHostedAccountLink({}),
    [createStripeHostedAccountLink],
  );

  useEffect(() => {
    // Only auto-refresh when the sheet is actually visible.
    // Without this guard, the effect fires on mount (even when hidden),
    // bumps refreshAt → query re-fetches → diditVerification changes →
    // effect re-fires → infinite loop.
    if (!visible) {
      return;
    }

    if (
      !shouldAutoRefreshIdentityStatus(
        diditVerification?.status,
        diditVerification?.isVerified ?? false,
        diditVerification?.sessionId,
      )
    ) {
      autoRefreshSessionIdRef.current = null;
      return;
    }

    if (autoRefreshSessionIdRef.current === diditVerification?.sessionId) {
      return;
    }
    autoRefreshSessionIdRef.current = diditVerification?.sessionId ?? null;

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
    visible,
    diditVerification?.isVerified,
    diditVerification?.sessionId,
    diditVerification?.status,
    refreshDiditStatus,
  ]);

  const startDiditVerification = useCallback(() => {
    if (isStartingDidit || isRefreshingDidit) {
      return;
    }

    setFeedback(null);
    setIsStartingDidit(true);
    setStripeKycVisible(true);
  }, [isRefreshingDidit, isStartingDidit]);

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
        setRefreshAt(Date.now());
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
        setRefreshAt(Date.now());
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

  const isLoading =
    !currentUser ||
    (currentUser?.role === "instructor" &&
      (instructorSettings === undefined ||
        compliance === undefined ||
        diditVerification === undefined));

  const { animatedStyle } = useContentReveal(isLoading);

  useEffect(() => {
    if (!visible) {
      didAutoCloseStripeRef.current = false;
      setStripeKycVisible(false);
      setIsStartingDidit(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!stripeKycVisible) {
      didAutoCloseStripeRef.current = false;
      return;
    }
    if (!diditVerification?.isVerified || didAutoCloseStripeRef.current) {
      return;
    }

    didAutoCloseStripeRef.current = true;
    setFeedback({
      tone: "success",
      message: t("profile.compliance.feedback.identityApproved"),
    });
    setIsStartingDidit(false);
    setStripeKycVisible(false);
  }, [diditVerification?.isVerified, stripeKycVisible, t]);

  // Guard: if still loading, show skeleton
  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
          <SkeletonProfile />
        </Box>
      </BaseProfileSheet>
    );
  }

  if (currentUser === null) {
    // Redirects will work since we're in the component tree
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg }} />
      </BaseProfileSheet>
    );
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg }} />
      </BaseProfileSheet>
    );
  }
  if (
    currentUser.role !== "instructor" ||
    !instructorSettings ||
    !compliance ||
    !diditVerification
  ) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg }} />
      </BaseProfileSheet>
    );
  }

  const diditStatusPresentation = getIdentityVerificationStatusPresentation(
    diditVerification.status,
    theme.color,
    t,
  );
  const isDiditBusy = isStartingDidit || isRefreshingDidit;
  const diditActionLabel = getIdentityPrimaryActionLabel(diditVerification.isVerified, t);
  const diditButtonColors = getIdentityActionButtonColors(
    diditVerification.isVerified,
    theme.color,
  );
  const handleDiditAction = () => {
    if (diditVerification.isVerified) {
      void refreshDiditStatus();
      return;
    }
    startDiditVerification();
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <Box
          gap="xl"
          style={{
            paddingHorizontal: BrandSpacing.inset,
            paddingTop: BrandSpacing.md,
            paddingBottom: BrandSpacing.xxl,
          }}
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
              backgroundColor: theme.color.surfaceElevated,
            }}
          >
            <Box flexDirection="row" alignItems="center" gap="md">
              <Box
                width={BrandSpacing.avatarMd}
                height={BrandSpacing.avatarMd}
                alignItems="center"
                justifyContent="center"
                style={{
                  borderRadius: Radius.lg,
                  backgroundColor: theme.color.surfaceMuted,
                  borderWidth: BorderWidth.medium,
                  borderColor: theme.color.border,
                }}
              >
                <IconSymbol name="person.fill" size={20} color={theme.color.primary} />
              </Box>
              <Box flex={1} minWidth={0} gap="xxs">
                <Text variant="titleLarge">{currentUserLabel}</Text>
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
                      letterSpacing: LetterSpacing.trackingWide,
                    }}
                  >
                    {diditStatusPresentation.label}
                  </Text>
                </Box>
              </Box>
            </Box>

            <Text variant="caption" color="textMuted">
              {diditVerification.isVerified
                ? t("profile.compliance.identity.approved")
                : t("profile.compliance.identity.required")}
            </Text>

            <Box gap="sm">
              {diditVerification.isVerified ? (
                <HStack justify="end">
                  <IconButton
                    accessibilityLabel={t("profile.identityVerification.refreshStatus")}
                    icon={
                      <IconSymbol name="arrow.clockwise" size={18} color={theme.color.primary} />
                    }
                    disabled={isDiditBusy}
                    onPress={() => {
                      void refreshDiditStatus();
                    }}
                    size={BrandSpacing.iconButtonSize}
                  />
                </HStack>
              ) : (
                <ActionButton
                  label={diditActionLabel}
                  icon={
                    <IconSymbol
                      name={diditVerification.isVerified ? "arrow.clockwise" : "checkmark.circle.fill"}
                      size={18}
                      color={diditVerification.isVerified ? theme.color.primary : theme.color.onPrimary}
                    />
                  }
                  onPress={handleDiditAction}
                  fullWidth
                  loading={isStartingDidit}
                  disabled={isDiditBusy}
                  native={false}
                  {...(diditButtonColors ? { colors: diditButtonColors } : {})}
                  labelStyle={{
                    textTransform: "uppercase",
                    letterSpacing: LetterSpacing.trackingWide,
                    fontWeight: "700",
                  }}
                />
              )}
            </Box>

            <StripeConnectEmbeddedModal
              visible={stripeKycVisible}
              accountStatus="action_required"
              mode="onboarding"
              createEmbeddedSession={handleCreateStripeEmbeddedSession}
              createHostedAccountLink={handleCreateStripeHostedAccountLink}
              onClose={() => {
                setIsStartingDidit(false);
                setStripeKycVisible(false);
              }}
              onCompleted={handleStripeKycCompleted}
              onFeedback={handleStripeKycFeedback}
            />
          </KitSurface>

          <Box gap="sm">
            <Text variant="radarLabel" color="textMuted">
              {t("profile.compliance.documents.title")}
            </Text>
            <VerificationUploadPanel
              icon="checkmark.circle.fill"
              label={t("profile.compliance.insurance.title")}
              subtitle={getInsuranceSubtitle(preferredInsurance ?? null, locale, t, {
                countryCode: marketCountry,
              })}
              statusLabel={getDocumentStatusLabel(preferredInsurance?.reviewStatus, t)}
              reviewStatus={preferredInsurance?.reviewStatus}
              onPress={onOpenInsuranceUpload}
              accentColor={theme.color.primary}
              disabled={isUploading}
            />
            <VerificationUploadPanel
              icon="sparkles"
              label={t("profile.compliance.certificate.title")}
              subtitle={getCertificateSubtitle(latestCertificate ?? null, locale, t)}
              statusLabel={getDocumentStatusLabel(latestCertificate?.reviewStatus, t)}
              reviewStatus={latestCertificate?.reviewStatus}
              onPress={onOpenCertificateUpload}
              accentColor={theme.color.primary}
              disabled={isUploading}
            />
          </Box>

          <KitSurface
            tone="sunken"
            padding={BrandSpacing.lg}
            gap={BrandSpacing.sm}
            style={{
              borderRadius: Radius.cardSubtle,
              borderWidth: BorderWidth.thin,
              borderColor: theme.color.border,
              backgroundColor: theme.color.surfaceElevated,
            }}
          >
            <Box flexDirection="row" alignItems="center" gap="xs">
              <Text variant="caption" color="textMuted">
                {latestCertificate?.reviewStatus === "approved"
                  ? t("profile.compliance.certificate.coverageTitle")
                  : t("profile.compliance.certificate.coveragePending")}
              </Text>
              <IconSymbol
                name="info.circle"
                size={BrandSpacing.iconSm}
                color={theme.color.textMuted}
              />
            </Box>
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
                      backgroundColor="surfaceMuted"
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
        </Box>
      </Animated.View>
    </BaseProfileSheet>
  );
}
