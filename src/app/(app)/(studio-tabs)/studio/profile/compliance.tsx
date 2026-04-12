import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { Box } from "@/primitives";
import { useTheme } from "@/hooks/use-theme";
import { ComplianceCard, type CardStatus } from "@/components/compliance/compliance-card";
import { ComplianceProgress } from "@/components/compliance/compliance-progress";
import { StudioBusinessInfoSheet } from "@/components/compliance/studio-business-info-sheet";
import { Redirect } from "expo-router";

type ExpandedSection = "identity" | "business" | "payment" | null;

export default function StudioComplianceScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  useProfileSubpageSheet({
    title: t("profile.navigation.compliance"),
    routeMatchPath: "/profile/compliance",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const shouldLoad = currentUser?.role === "studio";
  const accessSnapshot = useQuery(api.access.getMyStudioAccessSnapshot, shouldLoad ? {} : "skip");
  const connectedAccount = useQuery(
    api.paymentsV2.getMyStudioConnectedAccountV2,
    shouldLoad ? {} : "skip",
  );

  const compliance = accessSnapshot?.compliance;
  const verification = accessSnapshot?.verification;

  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [businessSheetVisible, setBusinessSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggle = useCallback(
    (section: ExpandedSection) => {
      setExpanded((prev) => (prev === section ? null : section));
    },
    [],
  );

  // ── Card statuses ──────────────────────────────────────────────
  const identityStatus: CardStatus = !verification
    ? "action_required"
    : verification.isVerified
      ? "complete"
      : verification.status === "pending"
        ? "in_progress"
        : "action_required";

  const businessStatus: CardStatus =
    !compliance?.billingProfile
      ? "action_required"
      : compliance.billingProfile.status === "complete"
        ? "complete"
        : "action_required";

  const paymentStatus: CardStatus = !connectedAccount
    ? "action_required"
    : connectedAccount.status === "active"
      ? "complete"
      : connectedAccount.status === "pending"
        ? "in_progress"
        : "action_required";

  const allComplete =
    identityStatus === "complete" &&
    businessStatus === "complete" &&
    paymentStatus === "complete";

  // ── Guards ─────────────────────────────────────────────────────
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
  if (accessSnapshot === undefined || connectedAccount === undefined) {
    return <LoadingScreen label={t("profile.studioCompliance.loading")} />;
  }

  const steps = [
    {
      label: t("profile.studioCompliance.sections.identity"),
      status: identityStatus,
      onPress: () => toggle("identity"),
    },
    {
      label: t("profile.studioCompliance.sections.billing"),
      status: businessStatus,
      onPress: () => toggle("business"),
    },
    {
      label: t("profile.studioCompliance.sections.payment"),
      status: paymentStatus,
      onPress: () => toggle("payment"),
    },
  ];

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
          onRefresh={() => setRefreshing(false)}
        />
      }
    >
      <Box style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.xl }}>
        {/* Hero */}
        <Box style={{ gap: BrandSpacing.sm }}>
          <ThemedText selectable style={BrandType.title}>
            {allComplete
              ? t("profile.studioCompliance.hero.readyTitle")
              : t("profile.studioCompliance.hero.blockedTitle")}
          </ThemedText>
          {!allComplete && (
            <ThemedText
              selectable
              type="caption"
              style={{ color: theme.color.textMuted }}
            >
              {t("profile.studioCompliance.hero.blockedBody", {
                blockers: countIncomplete(identityStatus, businessStatus, paymentStatus),
              })}
            </ThemedText>
          )}
        </Box>

        {/* Progress bar */}
        <ComplianceProgress steps={steps} />

        {/* Card 1: Identity */}
        <ComplianceCard
          title={t("profile.studioCompliance.sections.identity")}
          status={identityStatus}
          isExpanded={expanded === "identity"}
          onToggle={() => toggle("identity")}
        >
          <Box style={{ gap: BrandSpacing.md }}>
            {verification?.isVerified ? (
              <ThemedText style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.identity.approvedBody", {
                  legalName:
                    verification.legalName ??
                    currentUser.fullName ??
                    t("profile.account.fallbackName"),
                })}
              </ThemedText>
            ) : (
              <>
                <ThemedText style={{ color: theme.color.textMuted }}>
                  {t("profile.studioCompliance.identity.requiredBody")}
                </ThemedText>
                <ActionButton
                  label={t("profile.studioCompliance.identity.startVerification")}
                  onPress={() => {
                    // TODO: Launch Stripe Connect onboarding modal
                  }}
                />
              </>
            )}
          </Box>
        </ComplianceCard>

        {/* Card 2: Business Info */}
        <ComplianceCard
          title={t("profile.studioCompliance.sections.billing")}
          status={businessStatus}
          isExpanded={expanded === "business"}
          onToggle={() => toggle("business")}
        >
          <Box style={{ gap: BrandSpacing.md }}>
            {compliance?.billingProfile?.status === "complete" ? (
              <ThemedText style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.billing.completeSummary", {
                  name: compliance.billingProfile.legalBusinessName ?? "",
                })}
              </ThemedText>
            ) : (
              <ThemedText style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.billing.incompleteSummary")}
              </ThemedText>
            )}
            <ActionButton
              label={
                businessStatus === "complete"
                  ? t("profile.studioCompliance.billing.editBilling")
                  : t("profile.studioCompliance.billing.startBilling")
              }
              {...(businessStatus === "complete" ? { tone: "secondary" as const } : {})}
              onPress={() => setBusinessSheetVisible(true)}
            />
          </Box>
        </ComplianceCard>

        {/* Card 3: Payment Setup */}
        <ComplianceCard
          title={t("profile.studioCompliance.sections.payment")}
          status={paymentStatus}
          isExpanded={expanded === "payment"}
          onToggle={() => toggle("payment")}
        >
          <Box style={{ gap: BrandSpacing.md }}>
            {paymentStatus === "complete" ? (
              <ThemedText style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.payment.readySummary")}
              </ThemedText>
            ) : (
              <ThemedText style={{ color: theme.color.textMuted }}>
                {t("profile.studioCompliance.payment.setupSummary")}
              </ThemedText>
            )}
            <ActionButton
              label={
                paymentStatus === "complete"
                  ? t("profile.studioCompliance.payment.managePayments")
                  : t("profile.studioCompliance.payment.startSetup")
              }
              {...(paymentStatus === "complete" ? { tone: "secondary" as const } : {})}
              onPress={() => {
                // TODO: Launch Stripe Connect onboarding for payment setup
              }}
            />
          </Box>
        </ComplianceCard>
      </Box>

      {/* Business Info Sheet */}
      <StudioBusinessInfoSheet
        visible={businessSheetVisible}
        onClose={() => setBusinessSheetVisible(false)}
        billingProfile={compliance?.billingProfile ?? null}
        currentUserEmail={currentUser.email ?? ""}
        currentUserPhone={currentUser.phoneE164 ?? ""}
      />
    </ProfileSubpageScrollView>
  );
}

function countIncomplete(
  identity: CardStatus,
  business: CardStatus,
  payment: CardStatus,
): string {
  const incomplete = [identity, business, payment].filter(
    (s) => s !== "complete",
  ).length;
  return `${incomplete} step${incomplete !== 1 ? "s" : ""}`;
}
