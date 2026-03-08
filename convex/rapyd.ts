"use node";

import { createHmac, randomUUID } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;

const toAgorot = (amount: number): number =>
  Math.max(0, Math.round(amount * 100));

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConvexError(`Missing required environment variable: ${name}`);
  }
  return value;
};

type RapydSignatureEncoding = "hex_base64" | "raw_base64";

const resolvePreferredSignatureEncoding = (): RapydSignatureEncoding => {
  const value = (process.env.RAPYD_SIGNATURE_ENCODING ?? "hex_base64")
    .trim()
    .toLowerCase();
  return value === "raw_base64" ? "raw_base64" : "hex_base64";
};

const buildRapydSignature = ({
  method,
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
  encoding,
}: {
  method: string;
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
  encoding: RapydSignatureEncoding;
}): string => {
  const toSign = `${method.toLowerCase()}${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
  const digest = createHmac("sha256", secretKey).update(toSign);
  if (encoding === "raw_base64") {
    return digest.digest("base64");
  }
  const hexDigest = digest.digest("hex");
  return Buffer.from(hexDigest, "utf8").toString("base64");
};

const executeRapydSignedPost = async ({
  url,
  path,
  accessKey,
  secretKey,
  idempotency,
  body,
}: {
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
  idempotency: string;
  body: string;
}): Promise<{
  response: Response;
  responseText: string;
  signatureEncoding: RapydSignatureEncoding;
}> => {
  return await executeRapydSignedRequest({
    method: "POST",
    url,
    path,
    accessKey,
    secretKey,
    idempotency,
    body,
  });
};

const executeRapydSignedRequest = async ({
  method,
  url,
  path,
  accessKey,
  secretKey,
  idempotency,
  body,
}: {
  method: "GET" | "POST";
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
  idempotency?: string;
  body: string;
}): Promise<{
  response: Response;
  responseText: string;
  signatureEncoding: RapydSignatureEncoding;
}> => {
  const preferred = resolvePreferredSignatureEncoding();
  const fallback: RapydSignatureEncoding =
    preferred === "hex_base64" ? "raw_base64" : "hex_base64";
  const encodings: RapydSignatureEncoding[] = [preferred, fallback];

  let lastResponse: Response | null = null;
  let lastText = "";
  let lastEncoding: RapydSignatureEncoding = preferred;

  for (const encoding of encodings) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const salt = randomUUID().replace(/-/g, "");
    const signature = buildRapydSignature({
      method,
      path,
      salt,
      timestamp,
      accessKey,
      secretKey,
      body,
      encoding,
    });

    const response = await fetch(url, {
      method,
      headers: {
        access_key: accessKey,
        salt,
        timestamp,
        signature,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(idempotency ? { idempotency } : {}),
      },
      ...(method === "POST" ? { body } : {}),
    });
    const responseText = await response.text();
    lastResponse = response;
    lastText = responseText;
    lastEncoding = encoding;

    if (response.status !== 401) {
      return { response, responseText, signatureEncoding: encoding };
    }
  }

  return {
    response: lastResponse as Response,
    responseText: lastText,
    signatureEncoding: lastEncoding,
  };
};

const executeRapydSignedGet = async ({
  url,
  path,
  accessKey,
  secretKey,
}: {
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
}) =>
  executeRapydSignedRequest({
    method: "GET",
    url,
    path,
    accessKey,
    secretKey,
    body: "",
  });

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
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocalHost) {
    throw new ConvexError(`${fieldName} cannot use localhost`);
  }

  return parsed.toString();
};

const extractRapydErrorCode = (responseText: string): string | undefined => {
  try {
    const payload = JSON.parse(responseText) as {
      status?: { error_code?: string };
    };
    const errorCode = payload.status?.error_code?.trim();
    return errorCode || undefined;
  } catch {
    return undefined;
  }
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

type BeneficiaryOnboardingResult = {
  onboardingId: Id<"payoutDestinationOnboarding">;
  redirectUrl: string;
  merchantReferenceId: string;
};

type CheckoutStatusResult = {
  paymentId: Id<"payments">;
  checkoutId: string;
  checkoutStatus: "pending" | "completed" | "cancelled" | "failed";
  checkoutStatusRaw?: string;
  paymentStatus:
    | "created"
    | "pending"
    | "authorized"
    | "captured"
    | "failed"
    | "cancelled"
    | "refunded";
  providerPaymentId?: string;
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

    const checkoutContext = (await ctx.runQuery(
      internal.payments.getCheckoutContext,
      {
        jobId: args.jobId,
      },
    )) as CheckoutContext | null;
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

    const currency = (process.env.PAYMENTS_CURRENCY ?? "ILS")
      .trim()
      .toUpperCase();
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
    const rapydMode = (process.env.RAPYD_MODE ?? "sandbox")
      .trim()
      .toLowerCase();
    const isProduction = rapydMode === "production";
    const rapydBaseUrl = normalizeRapydBaseUrl(
      isProduction
        ? (process.env.RAPYD_PROD_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://api.rapyd.net")
        : (process.env.RAPYD_SANDBOX_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://sandboxapi.rapyd.net"),
    );

    const requestPath = "/v1/checkout";
    const country = (process.env.RAPYD_COUNTRY ?? "IL").trim().toUpperCase();
    const configuredMethods = process.env.RAPYD_PAYMENT_METHODS?.trim() ?? "";
    const methods = configuredMethods
      ? configuredMethods
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [];
    if (configuredMethods && methods.length === 0) {
      throw new ConvexError(
        "RAPYD_PAYMENT_METHODS is set but does not include any valid methods",
      );
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
        complete_payment_url: completeCheckoutUrl,
        error_payment_url: cancelCheckoutUrl,
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
      };
      if (methods.length > 0) {
        bodyPayload.payment_method_types_include = methods;
      }

      const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
      const body = JSON.stringify(bodyPayload);
      let { response, responseText, signatureEncoding } =
        await executeRapydSignedPost({
          url: requestUrl.toString(),
          path: requestUrl.pathname,
          accessKey,
          secretKey,
          idempotency: effectiveIdempotencyKey,
          body,
        });

      if (!response.ok && methods.length > 0) {
        const rapydErrorCode = extractRapydErrorCode(responseText);
        const shouldRetryWithoutMethodFilter =
          response.status === 400 &&
          rapydErrorCode?.includes(
            "ERROR_HOSTED_PAGE_UNRECOGNIZED_PAYMENT_METHOD_TYPES_TO_INCLUDE",
          );
        if (shouldRetryWithoutMethodFilter) {
          const fallbackPayload = {
            ...bodyPayload,
          };
          delete fallbackPayload.payment_method_types_include;
          const fallbackBody = JSON.stringify(fallbackPayload);
          const fallbackResult = await executeRapydSignedPost({
            url: requestUrl.toString(),
            path: requestUrl.pathname,
            accessKey,
            secretKey,
            idempotency: `${effectiveIdempotencyKey}:payment-method-fallback`,
            body: fallbackBody,
          });
          response = fallbackResult.response;
          responseText = fallbackResult.responseText;
          signatureEncoding = fallbackResult.signatureEncoding;
        }
      }

      if (!response.ok) {
        const responseSnippet = responseText.slice(0, 500);
        await ctx.runMutation(internal.payments.markPaymentError, {
          paymentId: pendingPayment._id,
          error: `Rapyd checkout HTTP ${response.status} [${signatureEncoding}]: ${responseSnippet}`,
        });
        throw new ConvexError(
          `Rapyd checkout failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseSnippet}`,
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
          payload.status?.message ??
          payload.status?.error_code ??
          "Unknown error";
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

export const retrieveCheckoutForPayment = action({
  args: {
    paymentId: v.id("payments"),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    checkoutId: v.string(),
    checkoutStatus: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    checkoutStatusRaw: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("created"),
      v.literal("pending"),
      v.literal("authorized"),
      v.literal("captured"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("refunded"),
    ),
    providerPaymentId: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<CheckoutStatusResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Only studios can check payment status");
    }

    const payment = await ctx.runQuery(
      internal.payments.getOwnedStudioPaymentForReconciliation,
      {
        paymentId: args.paymentId,
        studioUserId: currentUser._id,
      },
    );
    if (!payment) {
      throw new ConvexError("Payment not found");
    }
    if (!payment.providerCheckoutId) {
      throw new ConvexError("Payment does not have a Rapyd checkout yet");
    }

    const accessKey = getRequiredEnv("RAPYD_ACCESS_KEY");
    const secretKey = getRequiredEnv("RAPYD_SECRET_KEY");
    const rapydMode = (process.env.RAPYD_MODE ?? "sandbox")
      .trim()
      .toLowerCase();
    const isProduction = rapydMode === "production";
    const rapydBaseUrl = normalizeRapydBaseUrl(
      isProduction
        ? (process.env.RAPYD_PROD_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://api.rapyd.net")
        : (process.env.RAPYD_SANDBOX_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://sandboxapi.rapyd.net"),
    );

    const requestPath = `/v1/checkout/${payment.providerCheckoutId}`;
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const { response, responseText, signatureEncoding } =
      await executeRapydSignedGet({
        url: requestUrl.toString(),
        path: requestUrl.pathname,
        accessKey,
        secretKey,
      });
    if (!response.ok) {
      const snippet = responseText.slice(0, 500);
      throw new ConvexError(
        `Rapyd checkout lookup failed (HTTP ${response.status}) [${signatureEncoding}]: ${snippet}`,
      );
    }

    const payload = JSON.parse(responseText) as {
      status?: { status?: string; error_code?: string; message?: string };
      data?: {
        id?: string;
        status?: string;
        payment?: { id?: string; status?: string };
      };
    };
    const providerStatus = payload.status?.status ?? "ERROR";
    if (providerStatus !== "SUCCESS" || !payload.data?.id) {
      const providerReason =
        payload.status?.message ??
        payload.status?.error_code ??
        "Unknown error";
      throw new ConvexError(
        `Rapyd checkout lookup rejected: ${providerReason}`,
      );
    }

    const checkoutStatusRaw = payload.data.status?.trim().toUpperCase();
    const paymentStatusRaw = payload.data.payment?.status?.trim().toUpperCase();
    const providerPaymentId = payload.data.payment?.id?.trim() || undefined;

    const reconcile = await ctx.runMutation(
      internal.payments.reconcilePaymentFromCheckoutLookup,
      {
        paymentId: payment._id,
        providerCheckoutId: payload.data.id,
        ...omitUndefined({
          providerPaymentId,
          checkoutStatusRaw,
          paymentStatusRaw,
        }),
      },
    );

    const checkoutStatus =
      reconcile.paymentStatus === "captured"
        ? "completed"
        : reconcile.paymentStatus === "cancelled"
          ? "cancelled"
          : reconcile.paymentStatus === "failed" ||
              reconcile.paymentStatus === "refunded"
            ? "failed"
            : "pending";

    return {
      paymentId: payment._id,
      checkoutId: payload.data.id,
      checkoutStatus,
      paymentStatus: reconcile.paymentStatus,
      ...(checkoutStatusRaw ? { checkoutStatusRaw } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
    };
  },
});

export const createBeneficiaryOnboardingForInstructor = action({
  args: {
    beneficiaryCountry: v.optional(v.string()),
    beneficiaryEntityType: v.optional(
      v.union(v.literal("individual"), v.literal("company")),
    ),
    category: v.optional(v.string()),
    payoutCurrency: v.optional(v.string()),
    completeUrl: v.optional(v.string()),
    cancelUrl: v.optional(v.string()),
  },
  returns: v.object({
    onboardingId: v.id("payoutDestinationOnboarding"),
    redirectUrl: v.string(),
    merchantReferenceId: v.string(),
  }),
  handler: async (ctx, args): Promise<BeneficiaryOnboardingResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Only instructors can onboard payout destinations");
    }
    const verificationContext = await ctx.runQuery(
      internal.didit.getCurrentInstructorVerificationContext,
      {},
    );
    if (
      !verificationContext ||
      verificationContext.instructorProfile.diditVerificationStatus !==
        "approved"
    ) {
      throw new ConvexError(
        "Identity verification is required before payout onboarding. Complete Didit verification first.",
      );
    }

    const accessKey = getRequiredEnv("RAPYD_ACCESS_KEY");
    const secretKey = getRequiredEnv("RAPYD_SECRET_KEY");
    const rapydMode = (process.env.RAPYD_MODE ?? "sandbox")
      .trim()
      .toLowerCase();
    const isProduction = rapydMode === "production";
    const rapydBaseUrl = normalizeRapydBaseUrl(
      isProduction
        ? (process.env.RAPYD_PROD_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://api.rapyd.net")
        : (process.env.RAPYD_SANDBOX_BASE_URL ??
            process.env.RAPYD_BASE_URL ??
            "https://sandboxapi.rapyd.net"),
    );

    const beneficiaryCountry = (
      args.beneficiaryCountry ??
      process.env.RAPYD_COUNTRY ??
      "IL"
    )
      .trim()
      .toUpperCase();
    const beneficiaryEntityType = args.beneficiaryEntityType ?? "individual";
    const category = (args.category ?? "bank").trim().toLowerCase();
    const payoutCurrency = (
      args.payoutCurrency ??
      process.env.PAYMENTS_CURRENCY ??
      "ILS"
    )
      .trim()
      .toUpperCase();
    const completeUrl = resolveHostedPageUrl({
      provided: args.completeUrl ?? process.env.RAPYD_COMPLETE_CHECKOUT_URL,
      envName: "RAPYD_BENEFICIARY_COMPLETE_URL",
      fieldName: "completeUrl",
    });
    const cancelUrl = resolveHostedPageUrl({
      provided: args.cancelUrl ?? process.env.RAPYD_CANCEL_CHECKOUT_URL,
      envName: "RAPYD_BENEFICIARY_CANCEL_URL",
      fieldName: "cancelUrl",
    });

    const merchantReferenceId = `beneficiary:${currentUser._id}:${randomUUID()}`;
    const pendingSession = await ctx.runMutation(
      internal.payments.createBeneficiaryOnboardingSession,
      {
        userId: currentUser._id,
        provider: RAPYD_PROVIDER,
        merchantReferenceId,
        category,
        beneficiaryCountry,
        beneficiaryEntityType,
        payoutCurrency,
      },
    );
    if (!pendingSession?._id) {
      throw new ConvexError("Failed to create onboarding session");
    }

    const requestPath = "/v1/hosted/disburse/beneficiary";
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const bodyPayload: Record<string, unknown> = {
      category,
      sender_entity_type: "company",
      sender_country: (process.env.RAPYD_COUNTRY ?? "IL").trim().toUpperCase(),
      sender_currency: payoutCurrency,
      merchant_reference_id: merchantReferenceId,
      complete_url: completeUrl,
      cancel_url: cancelUrl,
      beneficiary_country: beneficiaryCountry,
      beneficiary_entity_type: beneficiaryEntityType,
      payout_currency: payoutCurrency,
    };

    const body = JSON.stringify(bodyPayload);
    try {
      const {
        response,
        responseText: text,
        signatureEncoding,
      } = await executeRapydSignedPost({
        url: requestUrl.toString(),
        path: requestUrl.pathname,
        accessKey,
        secretKey,
        idempotency: merchantReferenceId,
        body,
      });
      if (!response.ok) {
        await ctx.runMutation(
          internal.payments.markBeneficiaryOnboardingSessionFailed,
          {
            sessionId: pendingSession._id,
            error: `Rapyd beneficiary onboarding HTTP ${response.status} [${signatureEncoding}]: ${text.slice(0, 400)}`,
          },
        );
        throw new ConvexError(
          `Rapyd onboarding failed (HTTP ${response.status}) [${signatureEncoding}]: ${text.slice(0, 240)}`,
        );
      }

      const payload = JSON.parse(text) as {
        status?: { status?: string; message?: string; error_code?: string };
        data?: { redirect_url?: string; url?: string };
      };
      const redirectUrl =
        payload.data?.redirect_url?.trim() || payload.data?.url?.trim();
      if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !redirectUrl) {
        const reason =
          payload.status?.message ??
          payload.status?.error_code ??
          "Missing redirect_url";
        await ctx.runMutation(
          internal.payments.markBeneficiaryOnboardingSessionFailed,
          {
            sessionId: pendingSession._id,
            error: `Rapyd beneficiary onboarding rejected: ${reason}`,
          },
        );
        throw new ConvexError(`Rapyd onboarding rejected: ${reason}`);
      }

      await ctx.runMutation(
        internal.payments.markBeneficiaryOnboardingSessionPending,
        {
          sessionId: pendingSession._id,
          redirectUrl,
        },
      );

      return {
        onboardingId: pendingSession._id,
        redirectUrl,
        merchantReferenceId,
      };
    } catch (error) {
      await ctx.runMutation(
        internal.payments.markBeneficiaryOnboardingSessionFailed,
        {
          sessionId: pendingSession._id,
          error: error instanceof Error ? error.message : "onboarding_error",
        },
      );
      throw error;
    }
  },
});
