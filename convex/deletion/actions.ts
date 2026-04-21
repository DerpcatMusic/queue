"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getWebCrypto } from "../httpShared";
import { getStripeServer } from "../httpShared";

// =============================================================================
// OTP Helpers
// =============================================================================

async function hashOtp(code: string, salt: string): Promise<string> {
  const crypto = getWebCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(code + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Email Sending Actions
// =============================================================================

/**
 * Sends OTP email for account deletion verification.
 * Uses Resend API to send the code to the user's email.
 */
export const sendDeletionOtp = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const code = generateOtp();
    const salt = generateSalt();
    const hashedCode = await hashOtp(code, salt);

    // Clean up old OTPs for this user
    const now = Date.now();
    await ctx.runMutation(internal.deletion.cleanupExpiredOtps, {
      userId: args.userId,
      beforeTimestamp: now,
    });

    // Store OTP with 10-minute expiry
    const expiresAt = now + 10 * 60 * 1000;
    await ctx.runMutation(internal.deletion.storeDeletionOtp, {
      userId: args.userId,
      email: args.email,
      hashedCode,
      salt,
      expiresAt,
    });

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[Deletion] RESEND_API_KEY not configured");
      return { success: false, message: "Email service not configured" };
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Queue <noreply@join-queue.com>",
        to: args.email,
        subject: "Verify Account Deletion - Queue",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px;">Account Deletion Verification</h1>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 16px;">
              We received a request to delete your Queue account. Enter this code to confirm:
            </p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #666; line-height: 1.5;">
              This code expires in 10 minutes. If you didn't request this deletion, please ignore this email or contact support.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">
            <p style="font-size: 12px; color: #999;">
              Queue — Deleting your data in compliance with GDPR Article 17.
            </p>
          </div>
        `,
        text: `Account Deletion Verification\n\nYour verification code: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this deletion, please ignore this email.`,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[Deletion] Failed to send email:", errorText);
      return { success: false, message: "Failed to send verification email" };
    }

    return { success: true };
  },
});

// =============================================================================
// OTP Verification
// =============================================================================

export const verifyDeletionOtp = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    code: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the stored OTP
    const otpData = await ctx.runQuery(internal.deletion.getActiveDeletionOtp, {
      userId: args.userId,
      email: args.email,
      currentTimestamp: now,
    });

    if (!otpData) {
      return { success: false, error: "No valid OTP found. Please request a new one." };
    }

    if (otpData.attempts >= 3) {
      return { success: false, error: "Too many attempts. Please request a new code." };
    }

    // Verify the code
    const hashedInput = await hashOtp(args.code, otpData.salt);
    if (hashedInput !== otpData.hashedCode) {
      await ctx.runMutation(internal.deletion.incrementOtpAttempts, {
        otpId: otpData._id,
      });
      const remainingAttempts = 3 - otpData.attempts - 1;
      return {
        success: false,
        error: `Invalid code. ${remainingAttempts} attempt(s) remaining.`,
      };
    }

    // Mark deletion request as verified
    await ctx.runMutation(internal.deletion.markDeletionRequestVerified, {
      userId: args.userId,
    });

    // Invalidate the OTP
    await ctx.runMutation(internal.deletion.invalidateOtp, {
      otpId: otpData._id,
    });

    return { success: true };
  },
});

// =============================================================================
// Account Deletion Execution
// =============================================================================

export const executeAccountDeletion = internalAction({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { userId, role } = args;

    try {
      // 1. Delete DIDIT sessions if present
      await ctx.runMutation(internal.deletion.deleteDiditSessions, { userId });

      // 2. Cancel Stripe subscriptions and delete customer data
      await ctx.runMutation(internal.deletion.deleteStripeCustomerData, {
        userId,
        role,
      });

      // 3. Delete instructor/studio specific data
      if (role === "instructor") {
        await ctx.runMutation(internal.deletion.deleteInstructorProfileData, { userId });
      } else {
        await ctx.runMutation(internal.deletion.deleteStudioProfileData, { userId });
      }

      // 4. Delete marketplace jobs and related data
      await ctx.runMutation(internal.deletion.deleteMarketplaceData, { userId, role });

      // 5. Delete notifications
      await ctx.runMutation(internal.deletion.deleteNotificationData, { userId });

      // 6. Delete audit logs
      await ctx.runMutation(internal.deletion.deleteAuditData, { userId });

      // 7. Mark deletion as completed
      await ctx.runMutation(internal.deletion.markDeletionCompleted, { userId });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Deletion] Account deletion failed:", message);
      await ctx.runMutation(internal.deletion.markDeletionFailed, {
        userId,
        errorMessage: message,
      });
      return { success: false, error: message };
    }
  },
});

// =============================================================================
// DIDIT Session Deletion
// =============================================================================

export const deleteDiditSessions = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
      console.warn("[Deletion] DIDIT_API_KEY not configured, skipping session deletion");
      return null;
    }

    // Get session IDs from user profile
    const sessionIds = await ctx.runQuery(internal.deletion.getDiditSessionIds, { userId: args.userId });

    for (const sessionId of sessionIds) {
      try {
        const response = await fetch(
          `https://verification.didit.me/v3/session/${sessionId}/delete/`,
          {
            method: "DELETE",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          console.warn(`[Deletion] Failed to delete DIDIT session: ${sessionId}`);
        }
      } catch (error) {
        console.warn(`[Deletion] DIDIT session deletion error for ${sessionId}:`, error);
      }
    }

    return null;
  },
});

// =============================================================================
// Stripe Customer Deletion (Redaction)
// =============================================================================

export const deleteStripeCustomerData = internalAction({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stripe = getStripeServer();
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      console.warn("[Deletion] STRIPE_SECRET_KEY not configured, skipping Stripe deletion");
      return null;
    }

    // Get Stripe customer ID from user
    const stripeCustomerId = await ctx.runQuery(internal.deletion.getStripeCustomerId, {
      userId: args.userId,
    });

    if (!stripeCustomerId) {
      console.info(`[Deletion] No Stripe customer found for user ${args.userId}`);
      return null;
    }

    try {
      // Use Stripe's Data Deletion API
      // This permanently removes personal data from Stripe
      const response = await fetch(
        `https://api.stripe.com/v1/customers/${stripeCustomerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (!response.ok) {
        // If direct delete fails, try to redact using their redaction API
        await fetch("https://api.stripe.com/v1/customer-deletion/redact", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer: stripeCustomerId }),
        });
      }

      // If studio role, also handle connected account
      if (args.role === "studio") {
        const connectedAccountId = await ctx.runQuery(
          internal.deletion.getStripeConnectedAccountId,
          { userId: args.userId },
        );

        if (connectedAccountId) {
          // Cancel any pending payouts
          await ctx.runMutation(internal.deletion.cancelStripePayouts, {
            providerAccountId: connectedAccountId,
          });

          // Delete the connected account
          try {
            await stripe.accounts.del(connectedAccountId);
          } catch (accountError) {
            console.warn("[Deletion] Could not delete Stripe connected account:", accountError);
          }
        }
      }
    } catch (error) {
      console.error("[Deletion] Stripe customer deletion error:", error);
    }

    return null;
  },
});
