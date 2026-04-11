import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { STRIPE_CONNECT_RETURN_URL } from "@/lib/stripe";

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
  mode?: "auto" | "onboarding" | "payouts" | "payments" | "dashboard";
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
  onFeedback: (feedback: EmbeddedFeedback) => void;
  createEmbeddedSession: () => Promise<{ clientSecret: string }>;
  createHostedAccountLink: () => Promise<{ onboardingUrl: string }>;
};

export function StripeConnectEmbeddedModal({
  visible,
  accountStatus: _accountStatus,
  mode: _mode,
  onClose,
  onCompleted,
  onFeedback,
  createHostedAccountLink,
}: StripeConnectEmbeddedModalProps) {
  const [inFlight, setInFlight] = useState(false);

  useEffect(() => {
    if (!visible || inFlight) {
      return;
    }

    let cancelled = false;
    setInFlight(true);
    onFeedback(null);

    void (async () => {
      try {
        const session = await createHostedAccountLink();
        const result = await WebBrowser.openAuthSessionAsync(
          session.onboardingUrl,
          STRIPE_CONNECT_RETURN_URL,
        );

        if (cancelled) {
          return;
        }

        if (result.type === "success") {
          onFeedback({ tone: "success", message: "Stripe onboarding completed." });
          await onCompleted();
        } else if (result.type === "cancel") {
          onFeedback({ tone: "success", message: "Stripe onboarding was cancelled." });
        } else {
          onFeedback({ tone: "success", message: "Stripe onboarding was closed." });
        }
      } catch (error) {
        if (!cancelled) {
          onFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to open Stripe onboarding.",
          });
        }
      } finally {
        if (!cancelled) {
          setInFlight(false);
          onClose();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createHostedAccountLink, inFlight, onClose, onCompleted, onFeedback, visible]);

  return null;
}
