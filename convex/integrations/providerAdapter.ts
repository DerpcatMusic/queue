export type PaymentsProvider = "stripe";

export type CanonicalPaymentOrderStatus =
  | "draft"
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled";

export type CanonicalFundSplitStatus =
  | "pending_create"
  | "created"
  | "released"
  | "settled"
  | "failed"
  | "reversed";

export type CanonicalPayoutTransferStatus =
  | "pending"
  | "processing"
  | "sent"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

export type CanonicalConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export type MoneyBreakdown = {
  baseLessonAmountAgorot: number;
  bonusAmountAgorot: number;
  instructorOfferAmountAgorot: number;
  platformServiceFeeAgorot: number;
  studioChargeAmountAgorot: number;
};

export type CreateCheckoutSessionParams = {
  paymentOrderId: string;
  amountAgorot: number;
  currency: string;
  countryCode: string;
  connectedAccountId?: string;
  requestId: string;
  idempotencyKey: string;
  merchantOrderId: string;
  metadata?: Record<string, string>;
};

export type CheckoutSessionResult = {
  provider: PaymentsProvider;
  providerPaymentIntentId: string;
  clientSecret?: string;
  status: CanonicalPaymentOrderStatus;
  raw: unknown;
};

export type ConnectedAccountRequirement = {
  providerRequirementId: string;
  kind: "agreement" | "identity" | "business" | "bank_account" | "payment_method" | "other";
  code?: string;
  message: string;
  blocking: boolean;
};

export type EnsureConnectedAccountParams = {
  userId: string;
  countryCode: string;
  currency: string;
  role: "instructor";
};

export type EnsureConnectedAccountResult = {
  provider: PaymentsProvider;
  providerAccountId: string;
  status: CanonicalConnectedAccountStatus;
  accountCapability: "ledger" | "withdrawal" | "full";
  requirements: ConnectedAccountRequirement[];
  raw: unknown;
};

export type CreateFundSplitParams = {
  paymentOrderId: string;
  paymentAttemptId: string;
  amountAgorot: number;
  currency: string;
  sourcePaymentIntentId: string;
  destinationAccountId: string;
  autoRelease: boolean;
  requestId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type CreateFundSplitResult = {
  provider: PaymentsProvider;
  providerFundsSplitId: string;
  status: CanonicalFundSplitStatus;
  raw: unknown;
};

export type ReleaseFundSplitResult = {
  provider: PaymentsProvider;
  providerFundsSplitId: string;
  status: CanonicalFundSplitStatus;
  raw: unknown;
};

export type CreatePayoutTransferParams = {
  connectedAccountId: string;
  fundSplitId: string;
  amountAgorot: number;
  currency: string;
  requestId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type CreatePayoutTransferResult = {
  provider: PaymentsProvider;
  providerTransferId: string;
  status: CanonicalPayoutTransferStatus;
  raw: unknown;
};

export type CanonicalWebhookEvent = {
  provider: PaymentsProvider;
  providerEventId: string;
  eventType: string;
  occurredAt: number;
  objectType: "payment_intent" | "fund_split" | "connected_account" | "payout_transfer";
  objectId: string;
  statusRaw: string;
  raw: unknown;
};

export interface ProviderAdapter {
  readonly provider: PaymentsProvider;

  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;

  retrievePaymentIntent(paymentIntentId: string): Promise<CheckoutSessionResult>;

  ensureConnectedAccount(
    params: EnsureConnectedAccountParams,
  ): Promise<EnsureConnectedAccountResult>;

  createFundSplit(params: CreateFundSplitParams): Promise<CreateFundSplitResult>;

  releaseFundSplit(
    providerFundsSplitId: string,
    requestId: string,
  ): Promise<ReleaseFundSplitResult>;

  createPayoutTransfer(params: CreatePayoutTransferParams): Promise<CreatePayoutTransferResult>;

  verifyWebhookSignature(request: Request): Promise<boolean>;

  parseWebhookEvent(request: Request): Promise<CanonicalWebhookEvent>;
}
