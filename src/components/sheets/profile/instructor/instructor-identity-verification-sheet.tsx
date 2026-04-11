/**
 * Instructor Identity Verification Sheet.
 * Contains identity verification, insurance, and certificate management.
 */

import { useAction, useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, type AppStateStatus, Platform, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ActionButton } from "@/components/ui/action-button";
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
  shouldOfferIdentityManualRefresh,
} from "@/features/compliance/identity-verification-ui";
import {
  isComplianceDocumentUploadError,
  useComplianceDocumentUpload,
} from "@/hooks/use-compliance-document-upload";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { STRIPE_CONNECT_RETURN_URL } from "@/lib/stripe";
import { Box, HStack, Spacer, Text, VStack } from "@/primitives";
import { BorderWidth, LetterSpacing, Motion, Radius } from "@/theme/theme";

interface InstructorIdentityVerificationSheetProps {
  visible: boolean;
  onClose: () => void;
}

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

// ============================================================
// Skeleton - matches real compliance screen layout
// ============================================================

function SkeletonProfile() {
  const { color: theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <VStack gap="xl" style={{ padding: BrandSpacing.lg }}>
        {/* Identity verification card */}
        <Box p="lg" style={{ backgroundColor: theme.surfaceAlt, borderRadius: BrandRadius.soft }}>
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
            backgroundColor: theme.color.surfaceElevated,
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
                letterSpacing: LetterSpacing.trackingWide,
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

export function InstructorIdentityVerificationSheet({
  visible,
  onClose,
}: InstructorIdentityVerificationSheetProps) {
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
  const currentUser = useQuery(api.users.getCurrentUser);
  const complianceArgs = useMemo(
    () => (currentUser?.role === "instructor" ? (refreshAt ? { now: refreshAt } : {}) : "skip"),
    [currentUser?.role, refreshAt],
  );
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
  const createSessionForCurrentInstructor = useAction(
    api.paymentsV2Actions.createMyInstructorStripeAccountLinkV2,
  );
  const refreshMyDiditVerification = useAction(
    api.paymentsV2Actions.refreshMyInstructorStripeConnectedAccountV2,
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

  useEffect(() => {
    // Only auto-refresh when the sheet is actually visible.
    // Without this guard, the effect fires on mount (even when hidden),
    // bumps refreshAt → query re-fetches → diditVerification changes →
    // effect re-fires → infinite loop.
    if (!visible) {
      autoRefreshSessionIdRef.current = null;
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

  const startDiditVerification = useCallback(async () => {
    if (isStartingDidit || isRefreshingDidit) {
      return;
    }

    setIsStartingDidit(true);
    try {
      const session = await createSessionForCurrentInstructor({});
      const result = await WebBrowser.openAuthSessionAsync(
        session.onboardingUrl,
        STRIPE_CONNECT_RETURN_URL,
      );

      if (result.type === "success") {
        await refreshDiditStatus();
      } else if (result.type === "cancel") {
        setFeedback({
          tone: "success",
          message: t("profile.payments.cancelled"),
        });
      }
      if (Platform.OS === "ios") {
        setRefreshAt(Date.now());
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

  const isDiditBusy = isStartingDidit || isRefreshingDidit;
  const diditActionLabel = getIdentityPrimaryActionLabel(diditVerification.isVerified, t);
  const diditButtonColors = getIdentityActionButtonColors(
    diditVerification.isVerified,
    theme.color,
  );
  const diditStatusPresentation = getIdentityVerificationStatusPresentation(
    diditVerification.status,
    theme.color,
    t,
  );
  const showDiditManualRefresh = shouldOfferIdentityManualRefresh(
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
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <VStack
          gap="xl"
          style={{
            gap: BrandSpacing.xl,
            paddingHorizontal: BrandSpacing.inset,
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
                  backgroundColor: theme.color.surfaceAlt,
                  borderWidth: BorderWidth.medium,
                  borderColor: theme.color.border,
                }}
              >
                <IconSymbol name="person.fill" size={20} color={theme.color.primary} />
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
                      letterSpacing: LetterSpacing.trackingWide,
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
                <IconSymbol
                  name="info.circle"
                  size={BrandSpacing.iconSm}
                  color={theme.color.textMuted}
                />
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
                  letterSpacing: LetterSpacing.trackingWide,
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
                    letterSpacing: LetterSpacing.trackingWide,
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
              accentColor={theme.color.primary}
              disabled={isUploading}
            />
            <VerificationUploadPanel
              icon="sparkles"
              label={t("profile.compliance.certificate.title")}
              title={t("profile.compliance.documents.tapToUpload")}
              subtitle={getCertificateSubtitle(latestCertificate ?? null, locale, t)}
              statusLabel={getDocumentStatusLabel(latestCertificate?.reviewStatus, t)}
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
              backgroundColor: theme.color.surfaceElevated,
            }}
          ></KitSurface>
        </VStack>
      </Animated.View>
    </BaseProfileSheet>
  );
}
