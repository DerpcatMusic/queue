import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  type EmbeddedPaymentElementConfiguration,
  type PaymentSheet,
  useEmbeddedPaymentElement,
} from "@stripe/stripe-react-native";
import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ActionButton } from "@/components/ui/action-button";
import { BrandSpacing } from "@/constants/brand";
import { STRIPE_MERCHANT_DISPLAY_NAME, STRIPE_RETURN_URL } from "@/lib/stripe";
import { Box } from "@/primitives";

type StripeEmbeddedCheckoutDetails = {
  clientSecret: string;
  customerSessionClientSecret: string;
  amountAgorot: number;
  currency: string;
  providerCountry: string;
};

interface StripeEmbeddedCheckoutSheetProps {
  visible: boolean;
  checkout: StripeEmbeddedCheckoutDetails;
  onClose: () => void;
  onCompleted: () => void;
}

export function StripeEmbeddedCheckoutSheet({
  visible,
  checkout,
  onClose,
  onCompleted,
}: StripeEmbeddedCheckoutSheetProps) {
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const intentConfiguration = useMemo<PaymentSheet.IntentConfiguration>(
    () => ({
      mode: {
        amount: checkout.amountAgorot,
        currencyCode: checkout.currency,
      },
      confirmHandler: (_paymentMethod, _shouldSavePaymentMethod, intentCreationCallback) => {
        intentCreationCallback({
          clientSecret: checkout.clientSecret,
        });
      },
    }),
    [checkout.amountAgorot, checkout.clientSecret, checkout.currency],
  );

  const defaultBillingDetails = useMemo(() => {
    return {
      address: {
        country: checkout.providerCountry,
      },
    };
  }, [checkout.providerCountry]);

  const embeddedConfiguration = useMemo<EmbeddedPaymentElementConfiguration>(
    () => ({
      merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
      customerSessionClientSecret: checkout.customerSessionClientSecret,
      returnURL: STRIPE_RETURN_URL,
      allowsDelayedPaymentMethods: true,
      defaultBillingDetails: defaultBillingDetails,
      paymentMethodOrder: ["us_bank_account", "sepa_debit", "card"],
      ...(Platform.OS === "ios"
        ? {
            applePay: {
              merchantCountryCode: checkout.providerCountry,
            },
          }
        : {}),
      ...(Platform.OS === "android"
        ? {
            googlePay: {
              merchantCountryCode: checkout.providerCountry,
              currencyCode: checkout.currency,
              testEnv: __DEV__,
            },
          }
        : {}),
    }),
    [
      checkout.currency,
      checkout.customerSessionClientSecret,
      checkout.providerCountry,
      defaultBillingDetails,
    ],
  );

  const { embeddedPaymentElementView, confirm, loadingError, isLoaded } = useEmbeddedPaymentElement(
    intentConfiguration,
    embeddedConfiguration,
  );

  const handleConfirm = useCallback(async () => {
    try {
      const result = await confirm();
      if (result.status === "completed") {
        setFeedback({
          tone: "success",
          message: "Payment completed.",
        });
        onCompleted();
        return;
      }
      if (result.status === "canceled") {
        setFeedback({
          tone: "error",
          message: "Payment canceled.",
        });
        return;
      }
      setFeedback({
        tone: "error",
        message: result.error.message,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Payment failed",
      });
    }
  }, [confirm, onCompleted]);

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <BottomSheetScrollView contentContainerStyle={{ gap: BrandSpacing.lg }}>
        <Box style={{ padding: BrandSpacing.inset, gap: BrandSpacing.md }}>
          {feedback ? (
            <NoticeBanner
              tone={feedback.tone}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
            />
          ) : null}
          {loadingError ? (
            <NoticeBanner
              tone="error"
              message={loadingError.message}
              onDismiss={() => setFeedback(null)}
            />
          ) : null}
          {embeddedPaymentElementView}
          {isLoaded ? (
            <ActionButton label="Pay" fullWidth onPress={() => void handleConfirm()} />
          ) : null}
        </Box>
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
}
