/**
 * Airwallex Checkout Adapter
 *
 * Handles PaymentIntent creation and confirmation for student payments.
 */

import type {
  CheckoutResult,
  CheckoutStatus,
  RetrieveCheckoutResult,
} from "../../payment_provider";
import {
  AIRWALLEX_ENDPOINTS,
  executeAirwallexGet,
  executeAirwallexPost,
} from "../client";

// =============================================================================
// Types
// =============================================================================

interface AirwallexPaymentIntentResponse {
  id: string;
  client_secret?: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  order?: {
    id?: string;
  };
  metadata?: Record<string, string>;
}

interface AirwallexConfirmResponse {
  id: string;
  status: string;
  next_action?: {
    type: string;
    url?: string;
    method?: string;
  };
  payment_method?: {
    id: string;
    type: string;
  };
}

// =============================================================================
// Status Mapping
// =============================================================================

export const mapAirwallexPaymentIntentStatus = (status: string): CheckoutStatus => {
  const s = status.toUpperCase();
  switch (s) {
    case "CREATED":
      return "created";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "pending";
    case "REQUIRES_CUSTOMER_ACTION":
    case "PENDING_THIRD_PARTY_REDIRECT":
    case "PENDING_3DS":
      return "requires_action";
    case "SUCCEEDED":
    case "AUTHORIZED":
    case "CAPTURED":
      return "succeeded";
    case "FAILED":
    case "DECLINED":
      return "failed";
    case "CANCELLED":
    case "VOIDED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
};

// =============================================================================
// Create Payment Intent (Checkout)
// =============================================================================

export const createAirwallexPaymentIntent = async (params: {
  amountAgorot: number;
  currency: string;
  countryCode: string;
  returnUrl: string;
  failureUrl?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}): Promise<CheckoutResult> => {
  // Airwallex expects amount in major currency units (e.g., ILS, not agorot)
  const amountMajorUnit = params.amountAgorot / 100;

  const requestBody: Record<string, unknown> = {
    amount: amountMajorUnit,
    currency: params.currency.toUpperCase(),
    country_code: params.countryCode.toUpperCase(),
    return_url: params.returnUrl,
    merchant_order_id: params.idempotencyKey,
    metadata: params.metadata ?? {},
  };

  if (params.failureUrl) {
    requestBody.fail_url = params.failureUrl;
  }

  const response = await executeAirwallexPost<AirwallexPaymentIntentResponse>(
    AIRWALLEX_ENDPOINTS.PAYMENT_INTENTS_CREATE,
    requestBody,
    params.idempotencyKey,
  );

  const intent = response.data;

  // Determine redirect URL from next_action if present
  let clientSecret: string | undefined;

  if (intent.client_secret) {
    clientSecret = intent.client_secret;
  }

  // Calculate expiration (Airwallex default is 30 minutes)
  const expiresAt = Date.now() + 30 * 60 * 1000;

  const checkoutResult: CheckoutResult = {
    providerCheckoutId: intent.id,
    status: mapAirwallexPaymentIntentStatus(intent.status),
    expiresAt,
  };
  if (clientSecret) checkoutResult.clientSecret = clientSecret;
  return checkoutResult;
};

// =============================================================================
// Retrieve Payment Intent
// =============================================================================

export const retrieveAirwallexPaymentIntent = async (
  checkoutId: string,
): Promise<RetrieveCheckoutResult> => {
  const response = await executeAirwallexGet<AirwallexPaymentIntentResponse>(
    AIRWALLEX_ENDPOINTS.PAYMENT_INTENTS_GET(checkoutId),
  );

  const intent = response.data;

  const result: RetrieveCheckoutResult = {
    providerCheckoutId: intent.id,
    status: mapAirwallexPaymentIntentStatus(intent.status),
    amountAgorot: Math.round(intent.amount * 100),
    currency: intent.currency.toUpperCase(),
    rawProviderResponse: intent,
  };
  return result;
};

// =============================================================================
// Confirm Payment Intent
// =============================================================================

export const confirmAirwallexPaymentIntent = async (params: {
  checkoutId: string;
  clientSecret: string;
  paymentMethod: {
    type: string;
    card?: {
      cardNumber: string;
      expiryMonth: number;
      expiryYear: number;
      cvc: string;
    };
  };
  idempotencyKey: string;
}): Promise<{
  status: CheckoutStatus;
  redirectUrl?: string;
  providerPaymentId?: string;
}> => {
  const confirmBody: Record<string, unknown> = {
    confirmation_data: {
      payment_method: params.paymentMethod,
    },
  };

  const response = await executeAirwallexPost<AirwallexConfirmResponse>(
    AIRWALLEX_ENDPOINTS.PAYMENT_INTENTS_CONFIRM(params.checkoutId),
    confirmBody,
    params.idempotencyKey,
  );

  const confirmation = response.data;

  let redirectUrl: string | undefined;
  if (confirmation.next_action?.type === "redirect" && confirmation.next_action.url) {
    redirectUrl = confirmation.next_action.url;
  }

  const confirmationResult: { status: CheckoutStatus; redirectUrl?: string; providerPaymentId?: string } = {
    status: mapAirwallexPaymentIntentStatus(confirmation.status),
    providerPaymentId: confirmation.id,
  };
  if (redirectUrl) confirmationResult.redirectUrl = redirectUrl;
  return confirmationResult;
};

// =============================================================================
// Refund
// =============================================================================

export const createAirwallexRefund = async (params: {
  checkoutId: string;
  amountAgorot?: number; // If not provided, refund full amount
  currency: string;
  idempotencyKey: string;
}): Promise<{
  refundId: string;
  status: string;
}> => {
  const requestBody: Record<string, unknown> = {
    payment_intent_id: params.checkoutId,
    currency: params.currency.toUpperCase(),
    merchant_refund_id: params.idempotencyKey,
  };

  if (params.amountAgorot != null) {
    requestBody.amount = params.amountAgorot / 100;
  }

  const response = await executeAirwallexPost<{
    id: string;
    status: string;
    amount: number;
    currency: string;
  }>(AIRWALLEX_ENDPOINTS.REFUNDS_CREATE, requestBody, params.idempotencyKey);

  return {
    refundId: response.data.id,
    status: response.data.status,
  };
};
