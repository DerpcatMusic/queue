import type { ComponentType } from "react";

export type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export type StripeConnectEmbeddedModalProps = {
  visible: boolean;
  accountStatus: ConnectedAccountStatus | null;
  mode?: "auto" | "onboarding" | "payouts" | "payments" | "dashboard";
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
  onFeedback: (feedback: { tone: "success" | "error"; message: string } | null) => void;
  createEmbeddedSession: () => Promise<{ clientSecret: string }>;
  createHostedAccountLink: () => Promise<{ onboardingUrl: string }>;
};

export const StripeConnectEmbeddedModal: ComponentType<StripeConnectEmbeddedModalProps>;
