import {
  startVerification as startDiditVerification,
  VerificationStatus,
} from "@didit-protocol/sdk-react-native";
import { useAction, useQuery } from "convex/react";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, RefreshControl, View } from "react-native";
import { StudioBusinessInfoForm } from "@/components/compliance/studio-business-info-form";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box, HStack } from "@/primitives";

type StepId = "identity" | "business" | "payments";
type CardStatus = "complete" | "in_progress" | "action_required";

const STEP_ORDER: StepId[] = ["identity", "business", "payments"];

function getFirstIncompleteStep(identityStatus: CardStatus, businessStatus: CardStatus): StepId {
  if (identityStatus !== "complete") return "identity";
  if (businessStatus !== "complete") return "business";
  return "payments";
}

type StudioIdentityVerificationSession = {
  sessionId: string;
  sessionToken: string;
  verificationUrl: string;
  status:
    | "not_started"
    | "in_progress"
    | "pending"
    | "in_review"
    | "approved"
    | "declined"
    | "abandoned"
    | "expired";
};

function StudioIdentityVerificationEmbed({
  active,
  verified,
  verifiedName,
  verifiedDateLabel,
  onCompleted,
  refreshStudioIdentityVerification,
  createStudioIdentityVerificationSession,
}: {
  active: boolean;
  verified: boolean;
  verifiedName: string;
  verifiedDateLabel: string | null;
  onCompleted: () => Promise<void> | void;
  refreshStudioIdentityVerification: (args: { sessionId: string }) => Promise<{ status: string }>;
  createStudioIdentityVerificationSession: () => Promise<StudioIdentityVerificationSession>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const sessionPromiseRef = useRef<Promise<StudioIdentityVerificationSession> | null>(null);
  const sessionRef = useRef<StudioIdentityVerificationSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);

  const ensureSession = useCallback(
    async (forceNewSession = false) => {
      if (forceNewSession) {
        sessionPromiseRef.current = null;
        sessionRef.current = null;
      }
      sessionPromiseRef.current ??= createStudioIdentityVerificationSession().then((session) => {
        sessionRef.current = session;
        return session;
      });
      return await sessionPromiseRef.current;
    },
    [createStudioIdentityVerificationSession],
  );

  useEffect(() => {
    if (!active || verified) {
      return;
    }
    void ensureSession();
  }, [active, ensureSession, verified]);

  const startVerification = useCallback(
    async (forceNewSession = false) => {
      if (!active || isPresenting) {
        return;
      }

      setLoadError(null);
      setIsPresenting(true);
      try {
        const session = await ensureSession(forceNewSession);
        if (Platform.OS === "web") {
          await WebBrowser.openBrowserAsync(session.verificationUrl);
          return;
        }

        const result = await startDiditVerification(session.sessionToken, {
          loggingEnabled: __DEV__,
        });

        if (result.type === "completed") {
          await refreshStudioIdentityVerification({ sessionId: result.session.sessionId });
          if (result.session.status === VerificationStatus.Approved) {
            await onCompleted();
            return;
          }
          if (result.session.status === VerificationStatus.Pending) {
            setLoadError("Verification was submitted and is pending review.");
            return;
          }
          setLoadError("Verification was declined. Try again or contact support.");
          return;
        }

        if (result.type === "cancelled") {
          setLoadError("Verification was cancelled.");
          return;
        }

        if (result.type === "failed") {
          setLoadError(
            result.error.message ?? t("profile.studioCompliance.errors.identityStartFailed"),
          );
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : t("profile.studioCompliance.errors.identityStartFailed"),
        );
      } finally {
        setIsPresenting(false);
      }
    },
    [active, ensureSession, isPresenting, onCompleted, refreshStudioIdentityVerification, t],
  );

  if (!active) {
    return null;
  }

  if (loadError) {
    return (
      <Box style={{ gap: BrandSpacing.sm }}>
        <ThemedText style={{ color: theme.color.textMuted }}>{loadError}</ThemedText>
        <ActionButton
          label={t("profile.studioCompliance.actions.startIdentity")}
          fullWidth
          onPress={() => {
            void startVerification(true);
          }}
        />
      </Box>
    );
  }

  return (
    <Box style={{ gap: BrandSpacing.md }}>
      <Box style={{ gap: BrandSpacing.xs }}>
        <ThemedText style={{ color: theme.color.text, fontWeight: "700", fontSize: 22 }}>
          {verified
            ? verifiedName
              ? `Verified ${verifiedName}`
              : "Identity verified"
            : t("profile.studioCompliance.identity.title")}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
          {verified
            ? verifiedDateLabel
              ? `Verified on ${verifiedDateLabel}`
              : "Didit has the completed identity check on file."
            : "Open Didit’s native identity flow here. We sync the result back automatically."}
        </ThemedText>
      </Box>

      {!verified ? (
        <ActionButton
          label={
            isPresenting
              ? "Opening Didit..."
              : t("profile.studioCompliance.identity.startVerification")
          }
          fullWidth
          loading={isPresenting}
          disabled={isPresenting}
          onPress={() => {
            void startVerification(false);
          }}
        />
      ) : (
        <HStack style={{ gap: BrandSpacing.sm }}>
          <Box style={{ flex: 1 }}>
            <ActionButton
              label="Verify again"
              fullWidth
              onPress={() => {
                void startVerification(true);
              }}
            />
          </Box>
          <Box style={{ flex: 1 }}>
            <ActionButton
              label={t("profile.studioCompliance.identity.refreshVerification")}
              tone="secondary"
              fullWidth
              onPress={() => {
                const sessionId = sessionRef.current?.sessionId;
                if (!sessionId) {
                  void startVerification(true);
                  return;
                }
                void refreshStudioIdentityVerification({ sessionId });
              }}
            />
          </Box>
        </HStack>
      )}
    </Box>
  );
}

export default function StudioComplianceScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  useProfileSubpageSheet({
    title: t("profile.navigation.studioCompliance"),
    routeMatchPath: "/profile/compliance",
  });

  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);
  const shouldLoad = currentUser?.role === "studio";
  const studioSettings = useQuery(api.studios.settings.getMyStudioSettings, shouldLoad ? {} : "skip");
  const accessSnapshot = useQuery(api.access.snapshots.getMyStudioAccessSnapshot, shouldLoad ? {} : "skip");
  const createStudioIdentityVerificationSession = useAction(
    api.payments.actions.createMyStudioDiditVerificationSessionV2,
  );
  const refreshStudioIdentityVerification = useAction(
    api.payments.actions.refreshMyStudioDiditVerificationV2,
  );

  const compliance = accessSnapshot?.compliance;
  const verification = accessSnapshot?.verification;

  const [activeStep, setActiveStep] = useState<StepId>("identity");
  const [refreshing, setRefreshing] = useState(false);

  const identityStatus: CardStatus = !verification
    ? "action_required"
    : verification.isVerified
      ? "complete"
      : verification.status === "pending"
        ? "in_progress"
        : "action_required";

  const businessStatus: CardStatus = !compliance?.billingProfile
    ? "action_required"
    : compliance.billingProfile.status === "complete"
      ? "complete"
      : "action_required";
  const paymentStatus: CardStatus = !compliance
    ? "action_required"
    : compliance.summary.paymentStatus === "ready"
      ? "complete"
      : compliance.summary.paymentStatus === "pending"
        ? "in_progress"
        : "action_required";
  const allComplete =
    identityStatus === "complete" && businessStatus === "complete" && paymentStatus === "complete";
  const firstIncompleteStep = getFirstIncompleteStep(identityStatus, businessStatus);
  const verifiedName =
    verification?.legalName?.trim() ||
    [verification?.legalFirstName, verification?.legalLastName].filter(Boolean).join(" ").trim() ||
    currentUser?.name?.trim() ||
    "";
  const verifiedDateLabel = verification?.verifiedAt
    ? new Date(verification.verifiedAt).toLocaleDateString(i18n.resolvedLanguage ?? "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  useEffect(() => {
    setActiveStep((currentStep) => {
      if (allComplete) {
        return "payments";
      }
      const currentStatus =
        currentStep === "identity"
          ? identityStatus
          : currentStep === "business"
            ? businessStatus
            : paymentStatus;
      return currentStatus === "complete" ? firstIncompleteStep : currentStep;
    });
  }, [allComplete, businessStatus, firstIncompleteStep, identityStatus, paymentStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (verification?.sessionId) {
        await refreshStudioIdentityVerification({ sessionId: verification.sessionId });
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshStudioIdentityVerification, verification?.sessionId]);

  if (currentUser === undefined) {
    return <LoadingScreen label={t("profile.studioCompliance.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "studio") {
    return <Redirect href="/" />;
  }
  if (accessSnapshot === undefined || studioSettings === undefined) {
    return <LoadingScreen label={t("profile.studioCompliance.loading")} />;
  }

  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const remainingCount = [identityStatus, businessStatus, paymentStatus].filter(
    (status) => status !== "complete",
  ).length;
  const activeStatus =
    activeStep === "identity"
      ? identityStatus
      : activeStep === "business"
        ? businessStatus
        : paymentStatus;
  const showFooter = activeStep !== "identity";

  const activeTitle =
    activeStep === "identity"
      ? t("profile.studioCompliance.wizard.identityTitle")
      : activeStep === "business"
        ? t("profile.studioCompliance.wizard.businessTitle")
        : t("profile.studioCompliance.wizard.paymentTitle");

  const activeBody =
    activeStep === "identity"
      ? t("profile.studioCompliance.wizard.identityBody")
      : activeStep === "business"
        ? t("profile.studioCompliance.wizard.businessBody")
        : t("profile.studioCompliance.wizard.paymentBody");

  const stepChips = STEP_ORDER.map((step, index) => {
    const stepStatus =
      step === "identity" ? identityStatus : step === "business" ? businessStatus : paymentStatus;
    const isActive = step === activeStep;
    const isComplete = stepStatus === "complete";
    const toneColor = isComplete
      ? theme.color.success
      : isActive
        ? theme.color.primary
        : theme.color.border;

    return {
      step,
      index,
      label:
        step === "identity"
          ? t("profile.studioCompliance.sections.identity")
          : step === "business"
            ? t("profile.studioCompliance.sections.billing")
            : t("profile.studioCompliance.sections.payment"),
      stepStatus,
      isActive,
      isComplete,
      toneColor,
    };
  });

  return (
    <ProfileSubpageScrollView
      routeKey="studio/profile/compliance"
      style={{ flex: 1, backgroundColor: theme.color.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.xl }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void handleRefresh();
          }}
        />
      }
    >
      <Box style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.lg }}>
        <Box style={{ gap: BrandSpacing.sm }}>
          <ThemedText selectable style={BrandType.title}>
            {allComplete
              ? t("profile.studioCompliance.hero.readyTitle")
              : t("profile.studioCompliance.hero.blockedTitle")}
          </ThemedText>
          <ThemedText selectable type="caption" style={{ color: theme.color.textMuted }}>
            {allComplete
              ? t("profile.studioCompliance.hero.readyBody")
              : t("profile.studioCompliance.status.pendingCount", { count: remainingCount })}
          </ThemedText>
        </Box>

        <HStack style={{ gap: BrandSpacing.sm }}>
          {stepChips.map((chip) => (
            <Pressable
              key={chip.step}
              accessibilityRole="button"
              onPress={() => setActiveStep(chip.step)}
              style={{
                flex: 1,
                borderRadius: BrandRadius.lg,
                borderWidth: BorderWidth.thin,
                borderColor: chip.isActive ? theme.color.primary : "transparent",
                backgroundColor: chip.isActive
                  ? theme.color.surfaceMuted
                  : chip.isComplete
                    ? theme.color.surfaceMuted
                    : theme.color.surface,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.md,
                gap: BrandSpacing.xs,
              }}
            >
              <HStack style={{ alignItems: "center", gap: BrandSpacing.sm }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: chip.toneColor,
                  }}
                />
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("profile.studioCompliance.wizard.stepLabel", { current: chip.index + 1 })}
                </ThemedText>
              </HStack>
              <ThemedText
                numberOfLines={1}
                style={{ color: theme.color.text, fontWeight: chip.isActive ? "700" : "600" }}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          ))}
        </HStack>

        <Box style={{ gap: BrandSpacing.lg }}>
          <HStack style={{ alignItems: "center", gap: BrandSpacing.md }}>
            <Box
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.color.surfaceMuted,
              }}
            >
              <IconSymbol
                name={
                  activeStep === "identity"
                    ? "person.crop.circle.fill"
                    : activeStep === "business"
                      ? "building.2.fill"
                      : "creditcard.fill"
                }
                size={22}
                color={activeStatus === "complete" ? theme.color.success : theme.color.primary}
              />
            </Box>
            <Box style={{ flex: 1, gap: 2 }}>
              <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.wizard.stepCounter", {
                  current: activeIndex + 1,
                  total: STEP_ORDER.length,
                })}
              </ThemedText>
              <ThemedText style={{ color: theme.color.text, fontWeight: "700", fontSize: 22 }}>
                {activeTitle}
              </ThemedText>
            </Box>
          </HStack>

          <ThemedText style={{ color: theme.color.textMuted }}>{activeBody}</ThemedText>

          {activeStep === "identity" ? (
            <StudioIdentityVerificationEmbed
              active
              verified={identityStatus === "complete"}
              verifiedName={verifiedName}
              verifiedDateLabel={verifiedDateLabel}
              createStudioIdentityVerificationSession={async () =>
                createStudioIdentityVerificationSession({})
              }
              refreshStudioIdentityVerification={async (args) =>
                refreshStudioIdentityVerification(args)
              }
              onCompleted={async () => {
                setActiveStep("business");
              }}
            />
          ) : null}

          {activeStep === "business" ? (
            <StudioBusinessInfoForm
              billingProfile={compliance?.billingProfile ?? null}
              currentUserEmail={currentUser.email ?? ""}
              currentUserPhone={currentUser.phoneE164 ?? ""}
              defaultBusinessName={studioSettings?.studioName ?? ""}
              autoSave
            />
          ) : null}

          {activeStep === "payments" ? (
            <Box style={{ gap: BrandSpacing.md }}>
              <Box style={{ gap: BrandSpacing.xs }}>
                <ThemedText style={{ color: theme.color.text }}>
                  {paymentStatus === "complete"
                    ? t("profile.studioCompliance.payment.readySummary")
                    : t("profile.studioCompliance.payment.setupSummary")}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {paymentStatus === "complete"
                    ? "Review or change the saved payment method used to pay instructors."
                    : "Open payments to add the bank debit or card used to pay instructors."}
                </ThemedText>
              </Box>
              <ActionButton
                label={
                  paymentStatus === "complete"
                    ? t("profile.studioCompliance.payment.managePayments")
                    : t("profile.studioCompliance.payment.startSetup")
                }
                fullWidth
                onPress={() => {
                  router.push("/studio/profile/payments?setup=1");
                }}
              />
            </Box>
          ) : null}
        </Box>

        {showFooter ? (
          <HStack style={{ gap: BrandSpacing.md }}>
            <Box style={{ flex: 1 }}>
              <ActionButton
                label={t("common.back")}
                tone="secondary"
                fullWidth
                disabled={activeIndex === 0}
                onPress={() => {
                  if (activeIndex === 0) {
                    return;
                  }
                  setActiveStep(STEP_ORDER[activeIndex - 1] ?? "identity");
                }}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <ActionButton
                label={
                  allComplete && activeStep === "payments"
                    ? t("profile.studioCompliance.wizard.openJobs")
                    : activeStep === "payments"
                      ? t("profile.studioCompliance.payment.managePayments")
                      : t("profile.studioCompliance.wizard.next")
                }
                fullWidth
                disabled={activeStatus !== "complete" && activeStep !== "payments"}
                onPress={() => {
                  if (allComplete && activeStep === "payments") {
                    router.replace("/studio/jobs");
                    return;
                  }
                  if (activeStep === "payments" && paymentStatus !== "complete") {
                    router.push("/studio/profile/payments?setup=1");
                    return;
                  }
                  const nextStep = STEP_ORDER[activeIndex + 1];
                  if (nextStep) {
                    setActiveStep(nextStep);
                  }
                }}
              />
            </Box>
          </HStack>
        ) : null}
      </Box>
    </ProfileSubpageScrollView>
  );
}
