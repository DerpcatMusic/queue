/**
 * Instructor Payments Sheet.
 *
 * Two states:
 * - Not onboarded: Bottom sheet with status badge + onboarding CTA
 * - Active: Expanding bottom sheet with native tab bar + Stripe embedded components
 *   pre-warmed in the background for instant load.
 */

import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import {
  ConnectComponentsProvider,
  ConnectPayments,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type PaymentTab = "payments" | "payouts";

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
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { color } = theme;
  const locale = i18n.resolvedLanguage ?? "en";
  const publishableKey = getStripePublishableKey();

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

  // ─── Pre-warm everything ─────────────────────────────────────────────
  //
  // When the account is active, we pre-fetch the client secret AND
  // pre-create the Stripe Connect instance AND pre-mount the webviews
  // so everything is warm before the user opens the sheet.

  const prefetchedSecretRef = useRef<string | null>(null);
  const connectInstanceRef = useRef<ReturnType<typeof loadConnectAndInitialize> | null>(null);
  const [instanceReady, setInstanceReady] = useState(false);

  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const accountCopy = statusCopy(t, accountStatus, connectedAccount?.requirementsSummary ?? null);
  const accountTone = accountStatus ? STATUS_TONE[accountStatus] : accountCopy.tone;
  const isActive = accountStatus === "active";

  const isLoading = !currentUser || (isInstructor && connectedAccount === undefined);
  const { animatedStyle } = useContentReveal(isLoading);

  // Stripe appearance matching app theme exactly
  const themeColors = color;
  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: themeColors.primary,
        colorBackground: themeColors.surface,
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
      themeColors.surface,
      themeColors.surfaceAlt,
      themeColors.text,
      themeColors.textMuted,
    ],
  );

  // Pre-fetch client secret as soon as account is active
  useEffect(() => {
    if (!isActive || prefetchedSecretRef.current) return;
    void createStripeEmbeddedSession({}).then((result) => {
      prefetchedSecretRef.current = result.clientSecret;
    }).catch(() => {});
  }, [isActive, createStripeEmbeddedSession]);

  // Pre-create Stripe Connect instance as soon as we have a secret + key
  useEffect(() => {
    if (!isActive || !publishableKey || connectInstanceRef.current) return;
    if (!prefetchedSecretRef.current) return;

    const fetchClientSecret = async () => {
      if (prefetchedSecretRef.current) {
        return prefetchedSecretRef.current;
      }
      const session = await createStripeEmbeddedSession({});
      prefetchedSecretRef.current = session.clientSecret;
      return session.clientSecret;
    };

    connectInstanceRef.current = loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      locale,
      appearance,
    });
    setInstanceReady(true);
  }, [isActive, publishableKey, appearance, locale, createStripeEmbeddedSession]);

  const handleCreateStripeEmbeddedSession = useCallback(async () => {
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

  // ─── Effects ──────────────────────────────────────────────────────────

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

  // ─── Active: expanding bottom sheet with pre-warmed Stripe ──────────

  if (isActive) {
    const connectInstance = connectInstanceRef.current;

    return (
      <>
        {/* Pre-mounted Stripe webviews — hidden until sheet opens.
            These render off-screen so the webviews load their content
            in the background. When the sheet opens, they're already warm. */}
        {!visible && connectInstance && (
          <View style={styles.prewarmContainer} pointerEvents="none">
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <ConnectPayments />
              <ConnectPayouts />
            </ConnectComponentsProvider>
          </View>
        )}

        <BaseProfileSheet
          visible={visible}
          onClose={onClose}
          snapPoints={["50%", "95%"]}
          headerContent={
            <KitSegmentedToggle<PaymentTab>
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { label: t("profile.payments.tabs.earnings"), value: "payments" },
                { label: t("profile.payments.tabs.payouts"), value: "payouts" },
              ]}
            />
          }
        >
          <View style={styles.stripeContainer}>
            {connectInstance ? (
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <View
                  style={[styles.tabLayer, activeTab !== "payments" && styles.hiddenTab]}
                  pointerEvents={activeTab === "payments" ? "auto" : "none"}
                >
                  <ConnectPayments />
                </View>
                <View
                  style={[styles.tabLayer, activeTab !== "payouts" && styles.hiddenTab]}
                  pointerEvents={activeTab === "payouts" ? "auto" : "none"}
                >
                  <ConnectPayouts />
                </View>
              </ConnectComponentsProvider>
            ) : (
              <Box style={{ padding: BrandSpacing.xl, alignItems: "center" }}>
                <ThemedText style={{ color: color.textMuted }}>Loading...</ThemedText>
              </Box>
            )}
          </View>
        </BaseProfileSheet>
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

const styles = StyleSheet.create({
  // Off-screen pre-warm container — zero size, invisible, but webviews still mount + load
  prewarmContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  stripeContainer: {
    flex: 1,
    position: "relative",
    marginHorizontal: -BrandSpacing.lg, // Fill edge-to-edge inside the ScrollView padding
  },
  tabLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  hiddenTab: {
    opacity: 0,
  },
});
