import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectPayments,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KitSegmentedToggle } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { getStripePublishableKey } from "@/lib/stripe";
import { Box, HStack, Spacer, Text } from "@/primitives";

type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

type EmbeddedFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

type DashboardTab = "payments" | "payouts";

export type StripeConnectEmbeddedModalProps = {
  visible: boolean;
  accountStatus: ConnectedAccountStatus | null;
  mode?: "auto" | "onboarding" | "payouts" | "payments" | "dashboard";
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
  onFeedback: (feedback: EmbeddedFeedback) => void;
  createEmbeddedSession: () => Promise<{ clientSecret: string }>;
  createHostedAccountLink: () => Promise<{ onboardingUrl: string }>;
};

export function StripeConnectEmbeddedModal({
  visible,
  accountStatus,
  mode = "auto",
  onClose,
  onCompleted,
  onFeedback,
  createEmbeddedSession,
  createHostedAccountLink: _createHostedAccountLink,
}: StripeConnectEmbeddedModalProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const publishableKey = getStripePublishableKey();

  const [connectInstance, setConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("payments");

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
        buttonSecondaryColorBackground: themeColors.surfaceMuted,
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
      themeColors.surfaceMuted,
      themeColors.surfaceElevated,
      themeColors.text,
      themeColors.textMuted,
    ],
  );

  useEffect(() => {
    if (!visible || !publishableKey) {
      setConnectInstance(null);
      return;
    }

    setLoadError(null);
    setConnectInstance(
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        locale,
        appearance,
      }),
    );
  }, [appearance, fetchClientSecret, locale, publishableKey, visible]);

  useEffect(() => {
    if (!visible) {
      setLoadError(null);
      return;
    }
    if (publishableKey) {
      setLoadError(null);
      return;
    }
    setLoadError("Missing Stripe publishable key");
    onFeedback({
      tone: "error",
      message: "Stripe onboarding is unavailable on this device.",
    });
  }, [onFeedback, publishableKey, visible]);

  if (!visible) {
    return null;
  }

  // ─── Error state ──────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.appBg }}>
          <Box style={{ flex: 1, backgroundColor: theme.color.appBg, padding: BrandSpacing.lg }}>
            <HStack align="center" justify="between" gap="md">
              <Text variant="titleLarge">Verify identity</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close onboarding"
                onPress={onClose}
                style={({ pressed }) => ({
                  minHeight: BrandSpacing.buttonMinHeightSm,
                  paddingHorizontal: BrandSpacing.component,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: BrandRadius.pill,
                  borderWidth: BorderWidth.thin,
                  borderColor: theme.color.border,
                  backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surfaceMuted,
                })}
              >
                <Text variant="bodyStrong">Done</Text>
              </Pressable>
            </HStack>
            <Spacer size="sm" />
            <Text variant="caption" color="textMuted">
              {loadError ?? "Stripe onboarding is unavailable on this device."}
            </Text>
          </Box>
        </SafeAreaView>
      </Modal>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────

  if (!publishableKey || !connectInstance) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.appBg }}>
          <Box
            alignItems="center"
            justifyContent="center"
            style={{ flex: 1, backgroundColor: theme.color.appBg, padding: BrandSpacing.lg, gap: BrandSpacing.md }}
          >
            <ActivityIndicator size="large" color={theme.color.primary} />
            <Text variant="caption" color="textMuted">
              {loadError ? "Stripe unavailable" : "Connecting to Stripe..."}
            </Text>
          </Box>
        </SafeAreaView>
      </Modal>
    );
  }

  // ─── Mode resolution ──────────────────────────────────────────────────

  const isDashboard = mode === "dashboard";
  const onboardingMode =
    mode === "onboarding"
      ? true
      : mode === "payouts" || mode === "payments" || mode === "dashboard"
        ? false
        : accountStatus !== "active";
  const isPaymentsMode = mode === "payments";

  // ─── Onboarding (full-screen native Stripe) ───────────────────────────

  if (onboardingMode) {
    return (
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          title="Verify identity"
          onExit={async () => {
            try {
              await onCompleted();
            } finally {
              onClose();
            }
          }}
          onLoadError={(error) => {
            setLoadError(error.message);
            onFeedback({
              tone: "error",
              message: error.message,
            });
          }}
        />
      </ConnectComponentsProvider>
    );
  }

  // ─── Dashboard mode (tabbed full-screen) ──────────────────────────────

  if (isDashboard) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.appBg }}>
          <Box style={{ flex: 1, backgroundColor: theme.color.appBg }}>
            {/* Native header */}
            <Box
              style={{
                paddingHorizontal: BrandSpacing.lg,
                paddingTop: BrandSpacing.sm,
                paddingBottom: BrandSpacing.md,
              }}
            >
              <HStack align="center" justify="between" gap="md">
                <Text variant="titleLarge">{t("profile.payments.tabs.wallet")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  onPress={() => {
                    void (async () => {
                      try {
                        await onCompleted();
                      } finally {
                        onClose();
                      }
                    })();
                  }}
                  style={({ pressed }) => ({
                    minHeight: BrandSpacing.buttonMinHeightSm,
                    paddingHorizontal: BrandSpacing.component,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: BrandRadius.pill,
                    borderWidth: BorderWidth.thin,
                    borderColor: theme.color.border,
                    backgroundColor: pressed
                      ? theme.color.surfaceElevated
                      : theme.color.surfaceMuted,
                  })}
                >
                  <Text variant="bodyStrong">Done</Text>
                </Pressable>
              </HStack>
            </Box>

            {/* Native tab bar */}
            <Box style={{ paddingHorizontal: BrandSpacing.lg, paddingBottom: BrandSpacing.md }}>
              <KitSegmentedToggle<DashboardTab>
                value={dashboardTab}
                onChange={setDashboardTab}
                options={[
                  { label: t("profile.payments.tabs.earnings"), value: "payments" },
                  { label: t("profile.payments.tabs.payouts"), value: "payouts" },
                ]}
              />
            </Box>

            {/* Stripe components — both mounted, zIndex controls visibility */}
            <View style={styles.stripeContainer}>
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <View
                  style={[styles.tabLayer, dashboardTab === "payments" && styles.activeTab]}
                >
                  <ConnectPayments
                    onLoadError={(error) => {
                      setLoadError(error.message);
                      onFeedback({ tone: "error", message: error.message });
                    }}
                  />
                </View>
                <View
                  style={[styles.tabLayer, dashboardTab === "payouts" && styles.activeTab]}
                >
                  <ConnectPayouts
                    onLoadError={(error) => {
                      setLoadError(error.message);
                      onFeedback({ tone: "error", message: error.message });
                    }}
                  />
                </View>
              </ConnectComponentsProvider>
            </View>
          </Box>
        </SafeAreaView>
      </Modal>
    );
  }

  // ─── Single-mode (payments or payouts) full-screen ────────────────────

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.appBg }}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg, padding: BrandSpacing.lg }}>
          <HStack align="center" justify="between" gap="md">
            <Text variant="titleLarge">{isPaymentsMode ? "Payments" : "Payout settings"}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => {
                void (async () => {
                  try {
                    await onCompleted();
                  } finally {
                    onClose();
                  }
                })();
              }}
              style={({ pressed }) => ({
                minHeight: BrandSpacing.buttonMinHeightSm,
                paddingHorizontal: BrandSpacing.component,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: BrandRadius.pill,
                borderWidth: BorderWidth.thin,
                borderColor: theme.color.border,
                backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surfaceMuted,
              })}
            >
              <Text variant="bodyStrong">Done</Text>
            </Pressable>
          </HStack>
          <Spacer size="xs" />
          <Text variant="caption" color="textMuted">
            {isPaymentsMode
              ? "View payment history, details, and status."
              : "Review payout schedule, linked bank details, and withdrawal settings."}
          </Text>
          <Spacer size="lg" />
          <View style={{ flex: 1 }}>
            <ConnectComponentsProvider connectInstance={connectInstance}>
              {isPaymentsMode ? (
                <ConnectPayments
                  onLoadError={(error) => {
                    setLoadError(error.message);
                    onFeedback({ tone: "error", message: error.message });
                  }}
                />
              ) : (
                <ConnectPayouts
                  onLoadError={(error) => {
                    setLoadError(error.message);
                    onFeedback({ tone: "error", message: error.message });
                  }}
                />
              )}
            </ConnectComponentsProvider>
          </View>
        </Box>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stripeContainer: {
    flex: 1,
    position: "relative",
  },
  tabLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  activeTab: {
    zIndex: 1,
  },
});
