export type PaymentsProviderV2 = "airwallex";

export type CanonicalPaymentOrderStatusV2 =
  | "draft"
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled";

export type CanonicalFundSplitStatusV2 =
  | "pending_create"
  | "created"
  | "released"
  | "settled"
  | "failed"
  | "reversed";

export type CanonicalPayoutTransferStatusV2 =
  | "pending"
  | "processing"
  | "sent"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

export type CanonicalConnectedAccountStatusV2 =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export type V2MoneyBreakdown = {
  baseLessonAmountAgorot: number;
  bonusAmountAgorot: number;
  instructorOfferAmountAgorot: number;
  platformServiceFeeAgorot: number;
  studioChargeAmountAgorot: number;
};

export type CreateCheckoutSessionParamsV2 = {
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

export type CheckoutSessionResultV2 = {
  provider: PaymentsProviderV2;
  providerPaymentIntentId: string;
  clientSecret?: string;
  status: CanonicalPaymentOrderStatusV2;
  raw: unknown;
};

export type ConnectedAccountRequirementV2 = {
  providerRequirementId: string;
  kind: "agreement" | "identity" | "business" | "bank_account" | "payment_method" | "other";
  code?: string;
  message: string;
  blocking: boolean;
};

export type EnsureConnectedAccountParamsV2 = {
  userId: string;
  countryCode: string;
  currency: string;
  role: "instructor";
};

export type EnsureConnectedAccountResultV2 = {
  provider: PaymentsProviderV2;
  providerAccountId: string;
  status: CanonicalConnectedAccountStatusV2;
  accountCapability: "ledger" | "withdrawal" | "full";
  requirements: ConnectedAccountRequirementV2[];
  raw: unknown;
};

export type CreateFundSplitParamsV2 = {
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

export type CreateFundSplitResultV2 = {
  provider: PaymentsProviderV2;
  providerFundsSplitId: string;
  status: CanonicalFundSplitStatusV2;
  raw: unknown;
};

export type ReleaseFundSplitResultV2 = {
  provider: PaymentsProviderV2;
  providerFundsSplitId: string;
  status: CanonicalFundSplitStatusV2;
  raw: unknown;
};

export type CreatePayoutTransferParamsV2 = {
  connectedAccountId: string;
  fundSplitId: string;
  amountAgorot: number;
  currency: string;
  requestId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type CreatePayoutTransferResultV2 = {
  provider: PaymentsProviderV2;
  providerTransferId: string;
  status: CanonicalPayoutTransferStatusV2;
  raw: unknown;
};

export type CanonicalWebhookEventV2 = {
  provider: PaymentsProviderV2;
  providerEventId: string;
  eventType: string;
  occurredAt: number;
  objectType: "payment_intent" | "fund_split" | "connected_account" | "payout_transfer";
  objectId: string;
  statusRaw: string;
  raw: unknown;
};

export interface ProviderAdapterV2 {
  readonly provider: PaymentsProviderV2;

  createCheckoutSession(params: CreateCheckoutSessionParamsV2): Promise<CheckoutSessionResultV2>;

  retrievePaymentIntent(paymentIntentId: string): Promise<CheckoutSessionResultV2>;

  ensureConnectedAccount(params: EnsureConnectedAccountParamsV2): Promise<EnsureConnectedAccountResultV2>;

  createFundSplit(params: CreateFundSplitParamsV2): Promise<CreateFundSplitResultV2>;

  releaseFundSplit(
    providerFundsSplitId: string,
    requestId: string,
  ): Promise<ReleaseFundSplitResultV2>;

  createPayoutTransfer(params: CreatePayoutTransferParamsV2): Promise<CreatePayoutTransferResultV2>;

  verifyWebhookSignature(request: Request): Promise<boolean>;

  parseWebhookEvent(request: Request): Promise<CanonicalWebhookEventV2>;
}
