"use node";

import { createHmac, randomUUID } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;

const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConvexError(`Missing required environment variable: ${name}`);
  }
  return value;
};

const buildRapydSignature = ({
  method,
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
}: {
  method: string;
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
}): string => {
  const toSign = `${method.toLowerCase()}${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
  const hexDigest = createHmac("sha256", secretKey).update(toSign).digest("hex");
  return Buffer.from(hexDigest, "utf8").toString("base64");
};

const normalizeRapydBaseUrl = (rawValue: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new ConvexError("Rapyd base URL must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:") {
    throw new ConvexError("Rapyd base URL must use https");
  }
  if (parsed.username || parsed.password) {
    throw new ConvexError("Rapyd base URL must not include credentials");
  }
  if (parsed.search || parsed.hash) {
    throw new ConvexError("Rapyd base URL must not include query or hash");
  }
  // Keep only origin + optional path prefix without trailing slash.
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path === "/" ? "" : path}`;
};

const normalizeHostedPageUrl = (rawUrl: string, fieldName: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ConvexError(`${fieldName} must be a valid absolute URL`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new ConvexError(`${fieldName} must use http or https`);
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1";
  if (isLocalHost) {
    throw new ConvexError(`${fieldName} cannot use localhost`);
  }

  return parsed.toString();
};

const resolveHostedPageUrl = ({
  provided,
  envName,
  fieldName,
}: {
  provided: string | undefined;
  envName: string;
  fieldName: string;
}): string => {
  const raw = (provided?.trim() || process.env[envName]?.trim() || "").trim();
  if (!raw) {
    throw new ConvexError(
      `${fieldName} is required. Set ${envName} in Convex env to a public https URL.`,
    );
  }
  return normalizeHostedPageUrl(raw, fieldName);
};

type CheckoutContext = {
  user: {
    _id: Id<"users">;
    role: "studio" | "instructor" | "pending";
    email?: string;
    fullName?: string;
  };
  studio: {
    _id: Id<"studioProfiles">;
    studioName: string;
  };
  job: {
    _id: Id<"jobs">;
    status: "open" | "filled" | "cancelled" | "completed";
    studioId: Id<"studioProfiles">;
    filledByInstructorId?: Id<"instructorProfiles">;
    pay: number;
    sport: string;
    startTime: number;
  };
  instructorProfile: {
    _id: Id<"instructorProfiles">;
    userId: Id<"users">;
    displayName: string;
  } | null;
};

type CreateCheckoutResult = {
  paymentId: Id<"payments">;
  provider: "rapyd";
  checkoutId: string;
  checkoutUrl: string;
  studioChargeAmountAgorot: number;
  instructorBaseAmountAgorot: number;
  platformMarkupAmountAgorot: number;
  currency: string;
  idempotencyKey: string;
};

export const createCheckoutForJob = action({
  args: {
    jobId: v.id("jobs"),
    completeCheckoutUrl: v.optional(v.string()),
    cancelCheckoutUrl: v.optional(v.string()),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    provider: v.literal("rapyd"),
    checkoutId: v.string(),
    checkoutUrl: v.string(),
    studioChargeAmountAgorot: v.number(),
    instructorBaseAmountAgorot: v.number(),
    platformMarkupAmountAgorot: v.number(),
    currency: v.string(),
    idempotencyKey: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateCheckoutResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const checkoutContext = (await ctx.runQuery(internal.payments.getCheckoutContext, {
      jobId: args.jobId,
    })) as CheckoutContext | null;
    if (!checkoutContext) {
      throw new ConvexError("Checkout context not found");
    }

    const { user, studio, job, instructorProfile } = checkoutContext;
    if (user.role !== "studio") {
      throw new ConvexError("Only studios can create payments");
    }
    if (job.studioId !== studio._id) {
      throw new ConvexError("Unauthorized payment attempt");
    }
    if (!["filled", "completed"].includes(job.status)) {
      throw new ConvexError("Job is not payable yet");
    }
    if (!instructorProfile) {
      throw new ConvexError("No accepted instructor for this job");
    }
    const completeCheckoutUrl = resolveHostedPageUrl({
      provided: args.completeCheckoutUrl,
      envName: "RAPYD_COMPLETE_CHECKOUT_URL",
      fieldName: "completeCheckoutUrl",
    });
    const cancelCheckoutUrl = resolveHostedPageUrl({
      provided: args.cancelCheckoutUrl,
      envName: "RAPYD_CANCEL_CHECKOUT_URL",
      fieldName: "cancelCheckoutUrl",
    });

    const currency = (process.env.PAYMENTS_CURRENCY ?? "ILS").trim().toUpperCase();
    const markupBps = Math.min(
      5000,
      Math.max(
        0,
        Number.parseInt(process.env.QUICKFIT_PLATFORM_MARKUP_BPS ?? "1500", 10),
      ),
    );

    const instructorBaseAmountAgorot = toAgorot(job.pay);
    if (instructorBaseAmountAgorot <= 0) {
      throw new ConvexError("Job pay must be greater than zero");
    }
    const platformMarkupAmountAgorot = Math.floor(
      (instructorBaseAmountAgorot * markupBps) / 10000,
    );
    const studioChargeAmountAgorot =
      instructorBaseAmountAgorot + platformMarkupAmountAgorot;

    const accessKey = getRequiredEnv("RAPYD_ACCESS_KEY");
    const secretKey = getRequiredEnv("RAPYD_SECRET_KEY");
    const rapydMode = (process.env.RAPYD_MODE ?? "sandbox").trim().toLowerCase();
    const isProduction = rapydMode === "production";
    const rapydBaseUrl = normalizeRapydBaseUrl(
      isProduction
        ? (process.env.RAPYD_PROD_BASE_URL ??
          process.env.RAPYD_BASE_URL ??
          "https://api.rapyd.net")
        : (process.env.RAPYD_SANDBOX_BASE_URL ??
          process.env.RAPYD_BASE_URL ??
          "https://sandboxapi.rapyd.net")
    );

    const requestPath = "/v1/checkout";
    const country = (process.env.RAPYD_COUNTRY ?? "IL").trim().toUpperCase();
    const methods = (process.env.RAPYD_PAYMENT_METHODS ?? "il_card,apple_pay,google_pay")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (methods.length === 0) {
      throw new ConvexError("RAPYD_PAYMENT_METHODS must include at least one method");
    }

    const effectiveIdempotencyKey = `${RAPYD_PROVIDER}:${user._id}:${job._id}:${randomUUID()}`;
    let pendingPayment: { _id: Id<"payments"> } | null = null;

    try {
      pendingPayment = (await ctx.runMutation(
        internal.payments.createPendingPayment,
        {
          jobId: job._id,
          studioId: studio._id,
          studioUserId: user._id,
          instructorId: instructorProfile._id,
          instructorUserId: instructorProfile.userId,
          provider: RAPYD_PROVIDER,
          currency,
          instructorBaseAmountAgorot,
          platformMarkupAmountAgorot,
          studioChargeAmountAgorot,
          platformMarkupBps: markupBps,
          idempotencyKey: effectiveIdempotencyKey,
          metadata: {
            sport: job.sport,
            startTime: job.startTime,
          },
        },
      )) as { _id: Id<"payments"> } | null;

      if (!pendingPayment) {
        throw new ConvexError("Failed to create pending payment");
      }

      const bodyPayload: Record<string, unknown> = {
        amount: (studioChargeAmountAgorot / 100).toFixed(2),
        complete_checkout_url: completeCheckoutUrl,
        cancel_checkout_url: cancelCheckoutUrl,
        country,
        currency,
        customer: {
          email: user.email ?? undefined,
          name: studio.studioName || user.fullName || "Studio",
        },
        merchant_reference_id: pendingPayment._id,
        metadata: {
          paymentId: pendingPayment._id,
          jobId: job._id,
          studioId: studio._id,
          studioUserId: user._id,
          instructorUserId: instructorProfile.userId,
          instructorBaseAmountAgorot: String(instructorBaseAmountAgorot),
          platformMarkupAmountAgorot: String(platformMarkupAmountAgorot),
          studioChargeAmountAgorot: String(studioChargeAmountAgorot),
          startTime: String(job.startTime),
        },
        payment_method_types_include: methods,
      };

      const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
      const body = JSON.stringify(bodyPayload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const salt = randomUUID().replace(/-/g, "");
      const signature = buildRapydSignature({
        method: "POST",
        path: requestUrl.pathname,
        salt,
        timestamp,
        accessKey,
        secretKey,
        body,
      });

      const response = await fetch(requestUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_key: accessKey,
          salt,
          timestamp,
          signature,
          idempotency: effectiveIdempotencyKey,
        },
        body,
      });
      const responseText = await response.text();
      if (!response.ok) {
        const responseSnippet = responseText.slice(0, 500);
        await ctx.runMutation(internal.payments.markPaymentError, {
          paymentId: pendingPayment._id,
          error: `Rapyd checkout HTTP ${response.status}: ${responseSnippet}`,
        });
        throw new ConvexError(
          `Rapyd checkout failed (HTTP ${response.status}): ${responseSnippet}`,
        );
      }

      const payload = JSON.parse(responseText) as {
        status?: { status?: string; error_code?: string; message?: string };
        data?: {
          id?: string;
          payment?: { id?: string; status?: string };
          redirect_url?: string;
          complete_checkout_url?: string;
        };
      };
      const providerStatus = payload.status?.status ?? "ERROR";
      if (providerStatus !== "SUCCESS" || !payload.data?.id) {
        const providerReason =
          payload.status?.message ?? payload.status?.error_code ?? "Unknown error";
        await ctx.runMutation(internal.payments.markPaymentError, {
          paymentId: pendingPayment._id,
          error: `Rapyd checkout rejected: ${providerReason}`,
        });
        throw new ConvexError(`Rapyd checkout rejected: ${providerReason}`);
      }

      await ctx.runMutation(internal.payments.markCheckoutCreated, {
        paymentId: pendingPayment._id,
        providerCheckoutId: payload.data.id,
        metadata: {
          rapydProviderStatus: providerStatus,
        },
        ...omitUndefined({
          providerPaymentId: payload.data.payment?.id,
        }),
      });

      return {
        paymentId: pendingPayment._id,
        provider: RAPYD_PROVIDER,
        checkoutId: payload.data.id,
        checkoutUrl:
          payload.data.redirect_url ??
          payload.data.complete_checkout_url ??
          completeCheckoutUrl,
        studioChargeAmountAgorot,
        instructorBaseAmountAgorot,
        platformMarkupAmountAgorot,
        currency,
        idempotencyKey: effectiveIdempotencyKey,
      };
    } catch (error) {
      if (pendingPayment) {
        try {
          await ctx.runMutation(internal.payments.markPaymentError, {
            paymentId: pendingPayment._id,
            error: error instanceof Error ? error.message : "checkout_error",
          });
        } catch {
          // best-effort status patch
        }
      }
      throw error;
    }
  },
});
