/**
 * Instructor Payments Sheet.
 *
 * Two states:
 * - Not onboarded: Bottom sheet with status badge + onboarding CTA → opens full-screen Stripe onboarding
 * - Active: Full-screen Stripe dashboard modal with Earnings / Payouts tabs (no bottom sheet wrapper)
 */

import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitStatusBadge } from "@/components/ui/kit";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box, VStack } from "@/primitives";
import { Motion } from "@/theme/theme";

type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

const STATUS_TONE: Record<ConnectedAccountStatus, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  action_required: "warning",
  active: "success",
  restricted: "danger",
  rejected: "danger",
  disabled: "danger",
};

function SkeletonProfile() {
  const { color } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <Box gap="xl" p="lg">
        <Box
          p="xl"
          style={{ backgroundColor: color.surfaceElevated, borderRadius: BrandRadius.cardSubtle }}
        >
          <VStack gap="lg">
            <SkeletonLine width={120} height={14} />
            <SkeletonLine width="72%" height={36} />
            <SkeletonLine width="88%" height={14} />
          </VStack>
        </Box>
      </Box>
    </Animated.View>
  );
}

function statusCopy(
  t: ReturnType<typeof useTranslation>["t"],
  status?: ConnectedAccountStatus | null,
  requirementsSummary?: string | null,
) {
  if (!status) {
    return {
      label: t("profile.payments.statusBankNeeded"),
      caption: t("profile.payments.connectBank"),
      tone: "warning" as const,
    };
  }

  switch (status) {
    case "active":
      return {
        label: t("profile.payments.statusAllSet"),
        caption: t("profile.payments.successBody"),
        tone: "success" as const,
      };
    case "action_required":
    case "pending":
      return {
        label: t("profile.payments.finalizingTitle"),
        caption: requirementsSummary?.trim() || t("profile.payments.finalizingBody"),
        tone: "warning" as const,
      };
    case "restricted":
    case "rejected":
    case "disabled":
      return {
        label: t("profile.payments.onboardingFailed"),
        caption: t("profile.payments.connectBank"),
        tone: "danger" as const,
      };
  }
}

interface InstructorPaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorPaymentsSheet({ visible, onClose }: InstructorPaymentsSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { color } = theme;

  const currentUser = useQuery(api.users.getCurrentUser);
  const isInstructor = currentUser?.role === "instructor";

  const connectedAccount = useQuery(
    api.paymentsV2.getMyInstructorConnectedAccountV2,
    isInstructor ? {} : "skip",
  );

  const refreshStripeAccount = useAction(
    api.paymentsV2Actions.refreshMyInstructorStripeConnectedAccountV2,
  );
  const createStripeEmbeddedSession = useAction(
    api.paymentsV2Actions.createMyInstructorStripeEmbeddedSessionV2,
  );
  const createStripeHostedAccountLink = useAction(
    api.paymentsV2Actions.createMyInstructorStripeAccountLinkV2,
  );

  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectInfo, setConnectInfo] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  // Pre-fetched client secret — warmed when account is active so the
  // dashboard modal opens instantly instead of waiting for a server round-trip.
  const prefetchedSecretRef = useRef<string | null>(null);

  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const accountCopy = statusCopy(t, accountStatus, connectedAccount?.requirementsSummary ?? null);
  const accountTone = accountStatus ? STATUS_TONE[accountStatus] : accountCopy.tone;
  const isActive = accountStatus === "active";

  const isLoading = !currentUser || (isInstructor && connectedAccount === undefined);
  const { animatedStyle } = useContentReveal(isLoading);

  // Pre-fetch embedded session when account becomes active (before user opens sheet)
  useEffect(() => {
    if (!isActive || prefetchedSecretRef.current) return;
    void createStripeEmbeddedSession({}).then((result) => {
      prefetchedSecretRef.current = result.clientSecret;
    }).catch(() => {
      // Pre-fetch is best-effort; the modal will create its own session if needed
    });
  }, [isActive, createStripeEmbeddedSession]);

  useEffect(() => {
    if (!connectInfo) return;
    const timeout = setTimeout(() => setConnectInfo(null), Motion.emphasis);
    return () => clearTimeout(timeout);
  }, [connectInfo]);

  useEffect(() => {
    if (!visible) {
      setOnboardingVisible(false);
      setConnectBusy(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!onboardingVisible || accountStatus !== "active") {
      return;
    }
    setConnectInfo(t("profile.payments.connectSuccess"));
    setConnectError(null);
    setConnectBusy(false);
    setOnboardingVisible(false);
  }, [accountStatus, onboardingVisible, t]);

  const openOnboarding = useCallback(() => {
    setConnectBusy(true);
    setConnectError(null);
    setConnectInfo(null);
    setOnboardingVisible(true);
  }, []);

  const handleConnectFeedback = useCallback(
    (feedback: { tone: "success" | "error"; message: string } | null) => {
      if (!feedback) {
        setConnectError(null);
        setConnectInfo(null);
        return;
      }
      if (feedback.tone === "error") {
        setConnectError(feedback.message);
        setConnectInfo(null);
        return;
      }
      setConnectInfo(feedback.message);
      setConnectError(null);
    },
    [],
  );

  const handleConnectCompleted = useCallback(async () => {
    const refreshed = await refreshStripeAccount();
    setConnectInfo(
      refreshed.status === "active"
        ? t("profile.payments.connectSuccess")
        : t("profile.payments.finalizingBody"),
    );
    if (Platform.OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setConnectBusy(false);
    setOnboardingVisible(false);
  }, [refreshStripeAccount, t]);

  const handleCreateStripeEmbeddedSession = useCallback(async () => {
    // Use pre-fetched secret if available, otherwise fetch fresh
    const cached = prefetchedSecretRef.current;
    if (cached) {
      prefetchedSecretRef.current = null;
      return { clientSecret: cached };
    }
    return createStripeEmbeddedSession({});
  }, [createStripeEmbeddedSession]);

  const handleCreateStripeHostedAccountLink = useCallback(
    async () => createStripeHostedAccountLink({}),
    [createStripeHostedAccountLink],
  );

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: color.appBg }}>
          <SkeletonProfile />
        </Box>
      </BaseProfileSheet>
    );
  }

  // ─── Active: full-screen Stripe dashboard ────────────────────────────
  //
  // The dashboard modal is the primary UI for active accounts.
  // We also render a thin bottom sheet so the sheet system stays in sync,
  // but it immediately opens the full-screen modal on mount.

  if (isActive) {
    return (
      <>
        {/* Empty bottom sheet to keep sheet state valid — invisible behind the modal */}
        <BaseProfileSheet visible={visible} onClose={onClose}>
          <Box style={{ flex: 1, backgroundColor: color.appBg }} />
        </BaseProfileSheet>

        <StripeConnectEmbeddedModal
          visible={visible}
          accountStatus={accountStatus}
          mode="dashboard"
          createEmbeddedSession={handleCreateStripeEmbeddedSession}
          createHostedAccountLink={handleCreateStripeHostedAccountLink}
          onClose={onClose}
          onCompleted={async () => { await refreshStripeAccount(); }}
          onFeedback={handleConnectFeedback}
        />
      </>
    );
  }

  // ─── Not onboarded: bottom sheet with status + CTA ──────────────────

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <Box style={{ padding: BrandSpacing.lg, gap: BrandSpacing.lg }}>
          {connectError || connectInfo ? (
            <Box
              style={{
                backgroundColor: connectError ? color.dangerSubtle : color.surfaceAlt,
                borderRadius: BrandRadius.lg,
                paddingHorizontal: BrandSpacing.component,
                paddingVertical: BrandSpacing.stackDense,
                borderWidth: BorderWidth.thin,
                borderColor: connectError ? (color.danger as string) : color.border,
              }}
            >
              <ThemedText
                type="caption"
                style={{ color: connectError ? color.danger : color.textMuted }}
              >
                {connectError || connectInfo}
              </ThemedText>
            </Box>
          ) : null}

          <KitStatusBadge label={accountCopy.label} tone={accountTone} showDot />

          <ThemedText type="body" style={{ color: color.textMuted }}>
            {accountCopy.caption}
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              accountStatus
                ? t("profile.payments.resumeOnboarding")
                : t("profile.payments.startOnboarding")
            }
            onPress={openOnboarding}
            disabled={connectBusy}
            style={({ pressed }) => ({
              borderRadius: BrandRadius.medium,
              borderCurve: "Continuous" as const,
              minHeight: BrandSpacing.buttonMinHeightXl,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: BrandSpacing.sm,
              backgroundColor: connectBusy
                ? color.surfaceAlt
                : pressed
                  ? color.primaryPressed
                  : color.primary,
            })}
          >
            <IconSymbol
              name="building.columns.fill"
              size={BrandSpacing.iconSm}
              color={connectBusy ? color.textMuted : color.onPrimary}
            />
            <ThemedText
              type="labelStrong"
              style={{ color: connectBusy ? color.textMuted : color.onPrimary }}
            >
              {accountStatus
                ? t("profile.payments.resumeOnboarding")
                : t("profile.payments.startOnboarding")}
            </ThemedText>
          </Pressable>
        </Box>
      </Animated.View>

      <StripeConnectEmbeddedModal
        visible={onboardingVisible}
        accountStatus={accountStatus}
        mode="onboarding"
        createEmbeddedSession={handleCreateStripeEmbeddedSession}
        createHostedAccountLink={handleCreateStripeHostedAccountLink}
        onClose={() => {
          setConnectBusy(false);
          setOnboardingVisible(false);
        }}
        onCompleted={handleConnectCompleted}
        onFeedback={handleConnectFeedback}
      />
    </BaseProfileSheet>
  );
}
