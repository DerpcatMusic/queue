"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  mapStripePaymentIntentStatusToPaymentOrderStatus,
  type StripePaymentSheetSessionSummary,
  StripeSDK,
  stripeCustomers,
  stripePaymentSheetSessionSummaryValidator,
} from "./actionShared";

export const createStripePaymentSheetForPaymentOrder = action({
  args: {
    paymentOrderId: v.id("paymentOrders"),
  },
  returns: stripePaymentSheetSessionSummaryValidator,
  handler: async (ctx, args): Promise<StripePaymentSheetSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const checkoutContext: Awaited<
      ReturnType<typeof ctx.runQuery<typeof api.payments.core.getPaymentCheckoutContext>>
    > = await ctx.runQuery(api.payments.core.getPaymentCheckoutContext, {
      paymentOrderId: args.paymentOrderId,
    });
    if (!checkoutContext?.order) {
      throw new ConvexError("Payment order not found");
    }

    const { order, attempt, connectedAccount } = checkoutContext;
    if (order.provider !== "stripe") {
      throw new ConvexError("Payment order is not configured for Stripe");
    }
    if (!connectedAccount?.providerAccountId || connectedAccount.provider !== "stripe") {
      throw new ConvexError("Instructor Stripe account is required before checkout");
    }
    if (connectedAccount.status !== "active") {
      throw new ConvexError("Instructor Stripe account is not ready to receive funds");
    }

    if (
      attempt?.provider === "stripe" &&
      attempt.providerPaymentIntentId &&
      attempt.clientSecretRef
    ) {
      return {
        provider: "stripe",
        providerPaymentIntentId: attempt.providerPaymentIntentId,
        clientSecret: attempt.clientSecretRef,
        providerCountry: order.providerCountry,
        currency: order.currency,
        amountAgorot: order.pricing.studioChargeAmountAgorot,
        status: attempt.status,
      };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ConvexError("STRIPE_SECRET_KEY is not configured");
    }

    const customerArgs: {
      userId: string;
      email?: string;
      name?: string;
    } = {
      userId: String(currentUser._id),
    };
    const customerEmail = currentUser.email?.trim();
    if (customerEmail) {
      customerArgs.email = customerEmail;
    }
    const customerName = currentUser.name?.trim();
    if (customerName) {
      customerArgs.name = customerName;
    }
    const customer = await stripeCustomers.getOrCreateCustomer(ctx, customerArgs);
    const stripe = new StripeSDK(secretKey);
    const requestId = crypto.randomUUID();
    const idempotencyKey = `stripe:payment-intent:${order._id}`;
    // Destination charge model:
    // - customer pays the full studioChargeAmount
    // - instructor receives the net amount via transfer_data.destination
    // - platform keeps platformServiceFeeAgorot as the application fee
    // - Stripe processing fees are billed to the platform
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: order.pricing.studioChargeAmountAgorot,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        customer: customer.customerId,
        application_fee_amount: order.pricing.platformServiceFeeAgorot,
        ...(currentUser.email?.trim() ? { receipt_email: currentUser.email.trim() } : {}),
        metadata: {
          payment_order_id: String(order._id),
          job_id: String(order.jobId),
          instructor_user_id: String(order.instructorUserId),
          studio_user_id: String(order.studioUserId),
          connected_account_id: connectedAccount.providerAccountId,
        },
        on_behalf_of: connectedAccount.providerAccountId,
        transfer_data: {
          destination: connectedAccount.providerAccountId,
        },
        description: `Queue lesson ${order.correlationKey}`,
      },
      {
        idempotencyKey,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new ConvexError("Stripe did not return a PaymentIntent client secret");
    }

    const status = mapStripePaymentIntentStatusToPaymentOrderStatus(paymentIntent.status);

    await ctx.runMutation(internal.payments.core.recordStripePaymentIntentAttempt, {
      paymentOrderId: order._id,
      providerPaymentIntentId: paymentIntent.id,
      clientSecretRef: paymentIntent.client_secret,
      status,
      statusRaw: paymentIntent.status,
      requestId,
      idempotencyKey,
      metadata: {
        payment_order_id: String(order._id),
        job_id: String(order.jobId),
      },
    });

    return {
      provider: "stripe",
      providerPaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      customerId: customer.customerId,
      providerCountry: order.providerCountry,
      currency: order.currency,
      amountAgorot: order.pricing.studioChargeAmountAgorot,
      status,
    };
  },
});
