/**
 * Instructor Payments Sheet - tabbed bottom sheet with Stripe embedded components.
 *
 * When active: shows Payments / Payouts tabs with native Stripe UI rendered inline.
 * When not onboarded: shows status + onboarding button (opens full-screen Stripe modal).
 */

import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import {
  ConnectComponentsProvider,
  ConnectPayments,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSegmentedToggle } from "@/components/ui/kit";
import { KitStatusBadge } from "@/components/ui/kit";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { getStripePublishableKey } from "@/lib/stripe";
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

type PaymentTab = "payments" | "payouts";

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

/** Inline Stripe component that renders ConnectPayments or ConnectPayouts directly (no modal). */
function StripeInlineDashboard({
  activeTab,
  createEmbeddedSession,
}: {
  activeTab: PaymentTab;
  createEmbeddedSession: () => Promise<{ clientSecret: string }>;
}) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const publishableKey = getStripePublishableKey();

  const fetchClientSecret = useCallback(async () => {
    const session = await createEmbeddedSession();
    return session.clientSecret;
  }, [createEmbeddedSession]);

  const themeColors = theme.color;
  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: themeColors.primary,
        colorBackground: themeColors.surfaceElevated,
        colorText: themeColors.text,
        colorSecondaryText: themeColors.textMuted,
        colorDanger: themeColors.danger,
        buttonPrimaryColorBackground: themeColors.primary,
        buttonPrimaryColorBorder: themeColors.primary,
        buttonPrimaryColorText: themeColors.onPrimary,
        buttonSecondaryColorBackground: themeColors.surfaceAlt,
        buttonSecondaryColorBorder: themeColors.border,
        buttonSecondaryColorText: themeColors.text,
        borderRadius: "18px",
        spacingUnit: "12px",
      },
    }),
    [
      themeColors.border,
      themeColors.danger,
      themeColors.onPrimary,
      themeColors.primary,
      themeColors.surfaceAlt,
      themeColors.surfaceElevated,
      themeColors.text,
      themeColors.textMuted,
    ],
  );

  const [connectInstance, setConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null);

  useEffect(() => {
    if (!publishableKey) return;
    setConnectInstance(
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        locale,
        appearance,
      }),
    );
  }, [appearance, fetchClientSecret, locale, publishableKey]);

  if (!publishableKey || !connectInstance) {
    return (
      <Box style={{ padding: BrandSpacing.xl, alignItems: "center" }}>
        <ThemedText style={{ color: theme.color.textMuted }}>Loading...</ThemedText>
      </Box>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ConnectComponentsProvider connectInstance={connectInstance}>
        {activeTab === "payments" ? <ConnectPayments /> : <ConnectPayouts />}
      </ConnectComponentsProvider>
    </View>
  );
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
  const [activeTab, setActiveTab] = useState<PaymentTab>("payments");

  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const accountCopy = statusCopy(t, accountStatus, connectedAccount?.requirementsSummary ?? null);
  const accountTone = accountStatus ? STATUS_TONE[accountStatus] : accountCopy.tone;
  const isActive = accountStatus === "active";

  const isLoading = !currentUser || (isInstructor && connectedAccount === undefined);
  const { animatedStyle } = useContentReveal(isLoading);

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

  const handleCreateStripeEmbeddedSession = useCallback(
    async () => createStripeEmbeddedSession({}),
    [createStripeEmbeddedSession],
  );

  const handleCreateStripeHostedAccountLink = useCallback(
    async () => createStripeHostedAccountLink({}),
    [createStripeHostedAccountLink],
  );

  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, backgroundColor: color.appBg }}>
          <SkeletonProfile />
        </Box>
      </BaseProfileSheet>
    );
  }

  // Not onboarded yet — show status + onboarding button
  if (!isActive) {
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
                borderCurve: "continuous",
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

  // Active — show tabbed Stripe UI inline
  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Animated.View style={[styles.container, { backgroundColor: color.appBg }, animatedStyle]}>
        <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.md }}>
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

          <KitSegmentedToggle<PaymentTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { label: "Payments", value: "payments" },
              { label: "Payouts", value: "payouts" },
            ]}
          />
        </Box>

        <Box style={{ flex: 1, minHeight: 400, marginTop: BrandSpacing.md }}>
          <StripeInlineDashboard
            activeTab={activeTab}
            createEmbeddedSession={handleCreateStripeEmbeddedSession}
          />
        </Box>
      </Animated.View>
    </BaseProfileSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
