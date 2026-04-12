/**
 * Instructor Payments Sheet.
 *
 * Two states:
 * - Not onboarded: Bottom sheet with status badge + onboarding CTA
 * - Active: Full-screen modal (StripeConnectEmbeddedModal mode="dashboard")
 *   with tab bar + Stripe embedded components
 *
 * IMPORTANT: Stripe embedded components (ConnectPayments, ConnectPayouts) use
 * WebViews internally. They cannot be rendered inside @gorhom/bottom-sheet's
 * BottomSheetModal — the WebView conflicts with Gorham's gesture handling and
 * content measurement, preventing the sheet from presenting. Instead, the active
 * dashboard uses a React Native Modal (full screen) via StripeConnectEmbeddedModal.
 */

import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable } from "react-native";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitStatusBadge } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box, Text } from "@/primitives";

type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

type Feedback = { tone: "success" | "error"; message: string } | null;

const STATUS_TONE: Record<ConnectedAccountStatus, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  action_required: "warning",
  active: "success",
  restricted: "danger",
  rejected: "danger",
  disabled: "danger",
};

interface InstructorPaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorPaymentsSheet({ visible, onClose }: InstructorPaymentsSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

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
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const isActive = accountStatus === "active";
  const isLoading = !currentUser || (isInstructor && connectedAccount === undefined);

  useEffect(() => {
    if (!visible) {
      setOnboardingVisible(false);
      setConnectBusy(false);
      return;
    }
    setFeedback(null);
  }, [visible]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  // When onboarding completes and account becomes active, auto-close onboarding
  useEffect(() => {
    if (!onboardingVisible || accountStatus !== "active") return;
    void (async () => {
      const refreshed = await refreshStripeAccount();
      setFeedback({
        tone: "success",
        message:
          refreshed.status === "active"
            ? t("profile.payments.connectSuccess")
            : t("profile.payments.finalizingBody"),
      });
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setConnectBusy(false);
      setOnboardingVisible(false);
    })();
  }, [accountStatus, onboardingVisible, refreshStripeAccount, t]);

  const handleConnectFeedback = useCallback((next: Feedback) => {
    setFeedback(next);
  }, []);

  const handleCreateHostedAccountLink = useCallback(async () => {
    return createStripeHostedAccountLink({});
  }, [createStripeHostedAccountLink]);

  const accountLabel = accountStatus ? STATUS_TONE[accountStatus] : "warning";

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, padding: BrandSpacing.lg, justifyContent: "center" }}>
          <Text>Loading...</Text>
        </Box>
      </BaseProfileSheet>
    );
  }

  // ─── Active: full-screen modal with Stripe embedded dashboard ───────
  // Uses StripeConnectEmbeddedModal's "dashboard" mode which renders
  // ConnectPayments + ConnectPayouts inside a React Native Modal.
  // This avoids the BottomSheetModal + WebView conflict.

  if (isActive) {
    return (
      <StripeConnectEmbeddedModal
        visible={visible}
        accountStatus={accountStatus}
        mode="dashboard"
        createEmbeddedSession={async () => createStripeEmbeddedSession({})}
        createHostedAccountLink={handleCreateHostedAccountLink}
        onClose={onClose}
        onCompleted={async () => {
          // Dashboard doesn't need a completion callback, just close
        }}
        onFeedback={handleConnectFeedback}
      />
    );
  }

  // ─── Not onboarded: bottom sheet with status + CTA ──────────────────

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={{ flex: 1, padding: BrandSpacing.lg, gap: BrandSpacing.lg }}>
        {feedback ? (
          <Box
            style={{
              padding: BrandSpacing.component,
              borderRadius: BrandRadius.lg,
              borderWidth: BorderWidth.thin,
              borderColor: theme.color.border,
              backgroundColor:
                feedback.tone === "error" ? theme.color.dangerSubtle : theme.color.surfaceMuted,
            }}
          >
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {feedback.message}
            </ThemedText>
          </Box>
        ) : null}

        <KitStatusBadge
          label={
            accountStatus
              ? t("profile.payments.statusVerificationNeeded")
              : t("profile.payments.statusBankNeeded")
          }
          tone={accountLabel}
          showDot
        />

        <ThemedText type="body" style={{ color: theme.color.textMuted }}>
          {accountStatus ? t("profile.payments.finalizingBody") : t("profile.payments.connectBank")}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            accountStatus
              ? t("profile.payments.resumeOnboarding")
              : t("profile.payments.startOnboarding")
          }
          onPress={() => {
            setConnectBusy(true);
            setFeedback(null);
            setOnboardingVisible(true);
          }}
          disabled={connectBusy}
          style={({ pressed }) => ({
            borderRadius: BrandRadius.medium,
            minHeight: BrandSpacing.buttonMinHeightXl,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: BrandSpacing.sm,
            backgroundColor: connectBusy
              ? theme.color.surfaceMuted
              : pressed
                ? theme.color.primaryPressed
                : theme.color.primary,
          })}
        >
          <IconSymbol
            name="building.columns.fill"
            size={BrandSpacing.iconSm}
            color={connectBusy ? theme.color.textMuted : theme.color.onPrimary}
          />
          <ThemedText type="labelStrong" style={{ color: theme.color.onPrimary }}>
            {accountStatus
              ? t("profile.payments.resumeOnboarding")
              : t("profile.payments.startOnboarding")}
          </ThemedText>
        </Pressable>
      </Box>

      <StripeConnectEmbeddedModal
        visible={onboardingVisible}
        accountStatus={accountStatus}
        mode="onboarding"
        createEmbeddedSession={async () => createStripeEmbeddedSession({})}
        createHostedAccountLink={handleCreateHostedAccountLink}
        onClose={() => {
          setConnectBusy(false);
          setOnboardingVisible(false);
        }}
        onCompleted={async () => {
          const refreshed = await refreshStripeAccount();
          setFeedback({
            tone: "success",
            message:
              refreshed.status === "active"
                ? t("profile.payments.connectSuccess")
                : t("profile.payments.finalizingBody"),
          });
          if (Platform.OS === "ios") {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setConnectBusy(false);
          setOnboardingVisible(false);
        }}
        onFeedback={handleConnectFeedback}
      />
    </BaseProfileSheet>
  );
}
