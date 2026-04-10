import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectPayouts,
  loadConnectAndInitialize,
} from "@stripe/stripe-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, SafeAreaView, View } from "react-native";
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
  const { i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const publishableKey = getStripePublishableKey();

  const [loadError, setLoadError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!visible) {
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
                  backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surfaceAlt,
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
            setLoadError(error.message || error.type);
            onFeedback({
              tone: "error",
              message: error.message || error.type,
            });
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
                  setLoadError(error.message || error.type);
                  onFeedback({
                    tone: "error",
                    message: error.message || error.type,
                  });
                }}
              />
            </ConnectComponentsProvider>
          </View>
        </Box>
      </SafeAreaView>
    </Modal>
  );
}
