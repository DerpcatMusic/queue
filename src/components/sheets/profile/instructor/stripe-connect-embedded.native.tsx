import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, SafeAreaView, View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { getStripePublishableKey, STRIPE_CONNECT_RETURN_URL } from "@/lib/stripe";
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

export type StripeConnectEmbeddedModalProps = {
  visible: boolean;
  accountStatus: ConnectedAccountStatus | null;
  mode?: "auto" | "onboarding" | "payouts";
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
  onFeedback: (feedback: EmbeddedFeedback) => void;
  createEmbeddedSession: () => Promise<{ clientSecret: string }>;
  createHostedAccountLink: () => Promise<{ onboardingUrl: string }>;
};

async function openHostedFallback(
  createStripeAccountLink: () => Promise<{ onboardingUrl: string }>,
) {
  const session = await createStripeAccountLink();
  const result = await WebBrowser.openAuthSessionAsync(
    session.onboardingUrl,
    STRIPE_CONNECT_RETURN_URL,
  );
  return result.type;
}

export function StripeConnectEmbeddedModal({
  visible,
  accountStatus,
  mode = "auto",
  onClose,
  onCompleted,
  onFeedback,
  createEmbeddedSession,
  createHostedAccountLink,
}: StripeConnectEmbeddedModalProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const publishableKey = getStripePublishableKey();

  const [browserFallbackInFlight, setBrowserFallbackInFlight] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    const session = await createEmbeddedSession();
    return session.clientSecret;
  }, [createEmbeddedSession]);

  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: theme.color.primary,
        colorBackground: theme.color.surfaceElevated,
        colorText: theme.color.text,
        colorSecondaryText: theme.color.textMuted,
        colorDanger: theme.color.danger,
        buttonPrimaryColorBackground: theme.color.primary,
        buttonPrimaryColorBorder: theme.color.primary,
        buttonPrimaryColorText: theme.color.onPrimary,
        buttonSecondaryColorBackground: theme.color.surfaceAlt,
        buttonSecondaryColorBorder: theme.color.border,
        buttonSecondaryColorText: theme.color.text,
        borderRadius: "18px",
        spacingUnit: "12px",
      },
    }),
    [theme],
  );

  const connectInstance = useMemo(() => {
    if (!visible || !publishableKey) {
      return null;
    }

    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      locale,
      appearance,
    });
  }, [appearance, fetchClientSecret, locale, publishableKey, visible]);

  const openHostedFallbackSheet = useCallback(async () => {
    if (browserFallbackInFlight) {
      return;
    }
    setBrowserFallbackInFlight(true);
    onFeedback(null);

    try {
      const result = await openHostedFallback(createHostedAccountLink);
      if (result === "success") {
        onFeedback({ tone: "success", message: "Stripe onboarding opened and completed." });
        await onCompleted();
      } else if (result === "cancel") {
        onFeedback({ tone: "success", message: "Stripe onboarding was cancelled." });
      } else {
        onFeedback({ tone: "success", message: "Stripe onboarding was closed." });
      }
    } catch (error) {
      onFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to open Stripe onboarding.",
      });
    } finally {
      setBrowserFallbackInFlight(false);
      onClose();
    }
  }, [browserFallbackInFlight, createHostedAccountLink, onClose, onCompleted, onFeedback]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (publishableKey) {
      return;
    }
    void openHostedFallbackSheet();
  }, [openHostedFallbackSheet, publishableKey, visible]);

  if (!visible) {
    return null;
  }

  if (!publishableKey || !connectInstance) {
    return null;
  }

  const onboardingMode =
    mode === "onboarding" ? true : mode === "payouts" ? false : accountStatus !== "active";

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
          onLoadError={({ error }) => {
            onFeedback({
              tone: "error",
              message: error.message || error.type,
            });
            void openHostedFallbackSheet();
          }}
        />
      </ConnectComponentsProvider>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.appBg }}>
        <Box style={{ flex: 1, backgroundColor: theme.color.appBg, padding: BrandSpacing.lg }}>
          <HStack align="center" justify="between" gap="md">
            <Text variant="titleLarge">Payout settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close payouts"
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
                backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surfaceAlt,
              })}
            >
              <Text variant="bodyStrong">Done</Text>
            </Pressable>
          </HStack>
          <Spacer size="xs" />
          <Text variant="caption" color="textMuted">
            Review payout schedule, linked bank details, and withdrawal settings.
          </Text>
          <Spacer size="lg" />
          <View style={{ flex: 1, borderRadius: BrandRadius.soft, overflow: "hidden" }}>
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <ConnectPayouts
                onLoadError={({ error }) => {
                  onFeedback({
                    tone: "error",
                    message: error.message || error.type,
                  });
                  void openHostedFallbackSheet();
                }}
              />
            </ConnectComponentsProvider>
          </View>
        </Box>
      </SafeAreaView>
    </Modal>
  );
}
