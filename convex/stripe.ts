"use node";

import { StripeSubscriptions } from "@convex-dev/stripe";
import { ConvexError, v } from "convex/values";
import { api, components } from "./_generated/api";
import { action } from "./_generated/server";

const stripe = new StripeSubscriptions(components.stripe, {});

const normalizeUrl = (value: string, name: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError(`${name} is required`);
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    throw new ConvexError(`${name} must be a valid URL`);
  }
};

export const createCheckoutSession = action({
  args: {
    cancelUrl: v.string(),
    mode: v.optional(
      v.union(v.literal("payment"), v.literal("subscription"), v.literal("setup")),
    ),
    priceId: v.string(),
    successUrl: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const currentUser = (await ctx.runQuery(api.users.getCurrentUser, {})) as
      | {
          _id: string;
          email?: string | undefined;
          name?: string | undefined;
          role: string;
        }
      | null;
    if (!currentUser) {
      throw new ConvexError("Authentication required");
    }

    const email = currentUser.email?.trim();
    if (!email) {
      throw new ConvexError("An email address is required before starting Stripe checkout");
    }

    const customerArgs: {
      userId: string;
      email?: string;
      name?: string;
    } = {
      userId: String(currentUser._id),
      email,
    };
    const name = currentUser.name?.trim();
    if (name) {
      customerArgs.name = name;
    }

    const customer = await stripe.getOrCreateCustomer(ctx, customerArgs);

    return await stripe.createCheckoutSession(ctx, {
      priceId: args.priceId.trim(),
      customerId: customer.customerId,
      mode: args.mode ?? "payment",
      successUrl: normalizeUrl(args.successUrl, "successUrl"),
      cancelUrl: normalizeUrl(args.cancelUrl, "cancelUrl"),
      metadata: {
        appUserId: String(currentUser._id),
        appRole: currentUser.role,
      },
      paymentIntentMetadata: {
        appUserId: String(currentUser._id),
        appRole: currentUser.role,
      },
      subscriptionMetadata: {
        appUserId: String(currentUser._id),
        appRole: currentUser.role,
      },
    });
  },
});
