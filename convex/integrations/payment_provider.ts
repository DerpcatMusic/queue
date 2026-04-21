/**
 * Payment Provider Interface
 *
 * This module defines the canonical interface that all payment providers must implement.
 * Use this to add new providers (Stripe, Payme, etc.) without changing core logic.
 */

// =============================================================================
// Provider Identity
// =============================================================================

export type PaymentProviderId = "stripe" | "payme";

export interface PaymentProviderConfig {
  id: PaymentProviderId;
  displayName: string;
  supportedCountries: readonly string[];
  supportedCurrencies: readonly string[];
  webhookSignatureAlgo: "HMAC-SHA256" | "RSA-SHA256";
}

// =============================================================================
// Checkout (Student Payment)
// =============================================================================

export type CheckoutStatus =
  | "created"
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export interface CreateCheckoutParams {
  amountAgorot: number;
  currency: string;
  countryCode: string;
  returnUrl: string;
  failureUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  providerCheckoutId: string;
  status: CheckoutStatus;
  clientSecret?: string;
  redirectUrl?: string;
  expiresAt?: number;
}

export interface RetrieveCheckoutResult {
  providerCheckoutId: string;
  providerPaymentId?: string;
  status: CheckoutStatus;
  amountAgorot: number;
  currency: string;
  rawProviderResponse: unknown;
}

// =============================================================================
// Payment (Post-Checkout)
// =============================================================================

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

// =============================================================================
// Payout (Instructor Payment)
// =============================================================================

export type PayoutStatus =
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

export interface PayoutMethod {
  id: string;
  type: "bank_transfer" | "local" | "swift";
  currency: string;
  countryCode: string;
  description: string;
}

export interface CreatePayoutParams {
  amountAgorot: number;
  currency: string;
  destinationId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  providerPayoutId: string;
  status: PayoutStatus;
  estimatedDeliveryAt?: number;
  rawProviderResponse: unknown;
}

// =============================================================================
// Beneficiary Onboarding (KYC + Bank Account)
// =============================================================================

export type OnboardingStatus = "pending" | "completed" | "failed" | "expired";

export interface CreateBeneficiaryOnboardingParams {
  userId: Id<"users">;
  countryCode: string;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  entityType: "individual" | "company";
  redirectAmbientAmount?: number;
}

export interface BeneficiaryOnboardingResult {
  providerOnboardingId: string;
  redirectUrl?: string;
  status: OnboardingStatus;
  completedAt?: number;
}

export interface BeneficiaryOnboardingStatus {
  status: OnboardingStatus;
  beneficiaryId?: string;
  providerStatusRaw?: string;
  error?: string;
}

// =============================================================================
// Webhook Processing
// =============================================================================

export interface WebhookSignatureVerification {
  valid: boolean;
  timestamp?: string;
  signature?: string;
}

export interface CanonicalWebhookPayload {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  timestamp: number;
  paymentId?: string;
  checkoutId?: string;
  payoutId?: string;
  beneficiaryId?: string;
  status: string;
  statusRaw: string;
  rawPayload: unknown;
}

// =============================================================================
// Payment Provider Interface
// =============================================================================

export interface PaymentProvider {
  readonly config: PaymentProviderConfig;

  createCheckout(
    ctx: import("../_generated/server").MutationCtx,
    params: CreateCheckoutParams,
    idempotencyKey: string,
  ): Promise<CheckoutResult>;

  retrieveCheckout(
    ctx: import("../_generated/server").MutationCtx,
    checkoutId: string,
  ): Promise<RetrieveCheckoutResult>;

  mapPaymentStatus(rawStatus: string): PaymentStatus;

  createPayout(
    ctx: import("../_generated/server").MutationCtx,
    params: CreatePayoutParams,
  ): Promise<PayoutResult>;

  listPayoutMethods(
    ctx: import("../_generated/server").MutationCtx,
    countryCode: string,
    currency: string,
  ): Promise<PayoutMethod[]>;

  mapPayoutStatus(rawStatus: string): { status: PayoutStatus; terminal: boolean };

  createBeneficiaryOnboarding(
    ctx: import("../_generated/server").MutationCtx,
    params: CreateBeneficiaryOnboardingParams,
  ): Promise<BeneficiaryOnboardingResult>;

  getBeneficiaryOnboardingStatus(
    ctx: import("../_generated/server").MutationCtx,
    onboardingId: string,
  ): Promise<BeneficiaryOnboardingStatus>;

  verifyWebhookSignature(req: Request, secret: string): Promise<WebhookSignatureVerification>;

  parseWebhookPayload(req: Request): Promise<CanonicalWebhookPayload>;

  buildIdempotencyKey(key: string): string;
}

// =============================================================================
// Provider Registry (Country-based Routing)
// =============================================================================

export interface CountryProviderMapping {
  provider: PaymentProviderId;
  currency: string;
  fallbackProvider?: PaymentProviderId;
}

export const DEFAULT_COUNTRY_MAPPINGS: Record<string, CountryProviderMapping> = {
  // Israel → Stripe
  IL: { provider: "stripe", currency: "ILS" },

  // EU countries → Stripe Connect
  DE: { provider: "stripe", currency: "EUR" },
  FR: { provider: "stripe", currency: "EUR" },
  IT: { provider: "stripe", currency: "EUR" },
  ES: { provider: "stripe", currency: "EUR" },
  NL: { provider: "stripe", currency: "EUR" },
  BE: { provider: "stripe", currency: "EUR" },
  AT: { provider: "stripe", currency: "EUR" },
  PT: { provider: "stripe", currency: "EUR" },
  IE: { provider: "stripe", currency: "EUR" },
  PL: { provider: "stripe", currency: "EUR" },
  SE: { provider: "stripe", currency: "SEK" },
  DK: { provider: "stripe", currency: "DKK" },
  FI: { provider: "stripe", currency: "EUR" },
  NO: { provider: "stripe", currency: "NOK" },
  CH: { provider: "stripe", currency: "CHF" },
  GB: { provider: "stripe", currency: "GBP" },

  // USA → Stripe Connect
  US: { provider: "stripe", currency: "USD" },

  // Default → Stripe with USD
  DEFAULT: { provider: "stripe", currency: "USD" },
};

export function resolveProviderForCountry(countryCode: string): CountryProviderMapping {
  const mapping = DEFAULT_COUNTRY_MAPPINGS[countryCode.toUpperCase()];
  if (mapping) return mapping;
  return { provider: "stripe", currency: "USD" };
}

export function resolveCurrencyForCountry(
  countryCode: string,
  _provider: PaymentProviderId,
): string {
  const mapping = resolveProviderForCountry(countryCode);
  return mapping.currency;
}
