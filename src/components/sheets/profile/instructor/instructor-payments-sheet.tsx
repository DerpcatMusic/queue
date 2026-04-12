import {
  ConnectComponentsProvider,
  ConnectPayments,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSegmentedToggle, KitStatusBadge } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { getStripePublishableKey } from "@/lib/stripe";
import { Box, Text } from "@/primitives";

type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

type PaymentTab = "payments" | "payouts";

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
  const { t, i18n } = useTranslation();
  const theme = useTheme();
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
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentTab>("payments");
  const [connectInstance, setConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null);
  const connectInstanceStartedRef = useRef(false);
  const connectSessionPromiseRef = useRef<Promise<{ clientSecret: string }> | null>(null);

  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const isActive = accountStatus === "active";
  const isLoading = !currentUser || (isInstructor && connectedAccount === undefined);

  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: theme.color.primary,
        colorBackground: theme.color.surface,
        colorText: theme.color.text,
        colorSecondaryText: theme.color.textMuted,
        colorDanger: theme.color.danger,
        buttonPrimaryColorBackground: theme.color.primary,
        buttonPrimaryColorBorder: theme.color.primary,
        buttonPrimaryColorText: theme.color.onPrimary,
        buttonSecondaryColorBackground: theme.color.surfaceMuted,
        buttonSecondaryColorBorder: theme.color.border,
        buttonSecondaryColorText: theme.color.text,
        borderRadius: "18px",
        spacingUnit: "12px",
      },
    }),
    [
      theme.color.border,
      theme.color.danger,
      theme.color.onPrimary,
      theme.color.primary,
      theme.color.surface,
      theme.color.surfaceMuted,
      theme.color.text,
      theme.color.textMuted,
    ],
  );

  useEffect(() => {
    if (!visible) {
      setOnboardingVisible(false);
      setConnectBusy(false);
      return;
    }
    setFeedback(null);
  }, [visible]);

  useEffect(() => {
    if (visible && isActive) {
      switch (activeTab) {
        case "payments":
        case "payouts":
          setConnectBusy(true);
          break;
      }
    }
  }, [activeTab, isActive, visible]);

  useEffect(() => {
    if (!isActive || !publishableKey || connectInstanceStartedRef.current) {
      return;
    }

    connectInstanceStartedRef.current = true;
    const fetchClientSecret = async () => {
      connectSessionPromiseRef.current ??= createStripeEmbeddedSession({});
      const session = await connectSessionPromiseRef.current;
      return session.clientSecret;
    };

    setConnectInstance(
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        locale,
        appearance,
      }),
    );
  }, [appearance, createStripeEmbeddedSession, isActive, locale, publishableKey]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!onboardingVisible || accountStatus !== "active") {
      return;
    }
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

  const handleConnectLoadError = useCallback((error: Error) => {
    setFeedback({
      tone: "error",
      message: error.message || "Stripe embedded component failed to load.",
    });
  }, []);

  const handleCreateHostedAccountLink = useCallback(async () => {
    connectSessionPromiseRef.current = null;
    return createStripeHostedAccountLink({});
  }, [createStripeHostedAccountLink]);

  const accountLabel = accountStatus ? STATUS_TONE[accountStatus] : "warning";

  if (isLoading) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <Box style={{ flex: 1, padding: BrandSpacing.lg, justifyContent: "center" }}>
          <Text>Loading Stripe...</Text>
        </Box>
      </BaseProfileSheet>
    );
  }

  if (isActive) {
    return (
      <BaseProfileSheet
        visible={visible}
        onClose={onClose}
        snapPoints={["50%", "95%"]}
        edgeToEdge
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
        <Box style={styles.stripeContainer}>
          {connectInstance ? (
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <View style={styles.tabContainer}>
                {activeTab === "payments" ? (
                  <ConnectPayments
                    key="payments"
                    onLoaderStart={() => setConnectBusy(true)}
                    onPageDidLoad={() => setConnectBusy(false)}
                    onLoadError={(error) => {
                      setConnectBusy(false);
                      handleConnectLoadError(error);
                    }}
                  />
                ) : (
                  <ConnectPayouts
                    key="payouts"
                    onLoaderStart={() => setConnectBusy(true)}
                    onPageDidLoad={() => setConnectBusy(false)}
                    onLoadError={(error) => {
                      setConnectBusy(false);
                      handleConnectLoadError(error);
                    }}
                  />
                )}
              </View>
            </ConnectComponentsProvider>
          ) : (
            <Box style={styles.loadingContainer}>
              <Text>Loading Stripe...</Text>
            </Box>
          )}
          {connectBusy ? (
            <Box style={styles.loadingOverlay}>
              <Text>Loading Stripe...</Text>
            </Box>
          ) : null}
        </Box>
      </BaseProfileSheet>
    );
  }

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
        createEmbeddedSession={async () => {
          connectSessionPromiseRef.current ??= createStripeEmbeddedSession({});
          return connectSessionPromiseRef.current;
        }}
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

const styles = StyleSheet.create({
  stripeContainer: {
    flex: 1,
    position: "relative",
  },
  tabContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: BrandSpacing.lg,
    justifyContent: "center",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFFCC",
  },
});
