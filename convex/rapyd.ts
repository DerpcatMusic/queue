"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import {
  executeRapydSignedGet,
  executeRapydSignedPost,
  extractRapydErrorCode,
  resolveRapydCheckoutMethodSelection,
  resolveRapydRequestCredentials,
} from "./integrations/rapyd/client";
import {
  resolveHostedPageUrl,
  resolvePaymentsCurrency,
  resolveRapydCountry,
} from "./integrations/rapyd/config";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;

const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

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

    const currency = resolvePaymentsCurrency();
    const markupBps = Math.min(
      5000,
      Math.max(0, Number.parseInt(process.env.QUICKFIT_PLATFORM_MARKUP_BPS ?? "1500", 10)),
    );

    const instructorBaseAmountAgorot = toAgorot(job.pay);
    if (instructorBaseAmountAgorot <= 0) {
      throw new ConvexError("Job pay must be greater than zero");
    }
    const platformMarkupAmountAgorot = Math.floor((instructorBaseAmountAgorot * markupBps) / 10000);
    const studioChargeAmountAgorot = instructorBaseAmountAgorot + platformMarkupAmountAgorot;

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();

    const requestPath = "/v1/checkout";
    const country = resolveRapydCountry();
    const configuredMethods = process.env.RAPYD_PAYMENT_METHODS;
    const checkoutMethodSelection = await resolveRapydCheckoutMethodSelection({
      configured: configuredMethods,
      country,
      currency,
      accessKey,
      secretKey,
      baseUrl: rapydBaseUrl,
    });
    if (checkoutMethodSelection.warnings.length > 0) {
      throw new ConvexError(checkoutMethodSelection.warnings.join(" | "));
    }

    const effectiveIdempotencyKey = `${RAPYD_PROVIDER}:${user._id}:${job._id}:${crypto.randomUUID()}`;
    let pendingPayment: { _id: Id<"payments"> } | null = null;

    try {
      pendingPayment = (await ctx.runMutation(internal.payments.createPendingPayment, {
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
      })) as { _id: Id<"payments"> } | null;

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
      if (checkoutMethodSelection.paymentMethodTypesInclude?.length) {
        bodyPayload.payment_method_types_include =
          checkoutMethodSelection.paymentMethodTypesInclude;
      }

      const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
      const body = JSON.stringify(bodyPayload);
      const { response, responseText, signatureEncoding } = await executeRapydSignedPost({
        url: requestUrl.toString(),
        path: requestUrl.pathname,
        accessKey,
        secretKey,
        idempotency: effectiveIdempotencyKey,
        body,
      });

      if (!response.ok) {
        const responseSnippet = responseText.slice(0, 500);
        const rapydErrorCode = extractRapydErrorCode(responseText);
        await ctx.runMutation(internal.payments.markPaymentError, {
          paymentId: pendingPayment._id,
          error: `Rapyd checkout HTTP ${response.status} [${signatureEncoding}]${rapydErrorCode ? ` (${rapydErrorCode})` : ""}: ${responseSnippet}`,
        });
        throw new ConvexError(
          `Rapyd checkout failed (HTTP ${response.status}) [${signatureEncoding}]${rapydErrorCode ? ` (${rapydErrorCode})` : ""}: ${responseSnippet}`,
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
          rapydRequestedPaymentMethodSelectors: checkoutMethodSelection.requestedSelectors,
          rapydResolvedPaymentMethodTypes: checkoutMethodSelection.paymentMethodTypesInclude,
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
          payload.data.redirect_url ?? payload.data.complete_checkout_url ?? completeCheckoutUrl,
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

    const payment = await ctx.runQuery(internal.payments.getOwnedStudioPaymentForReconciliation, {
      paymentId: args.paymentId,
      studioUserId: currentUser._id,
    });
    if (!payment) {
      throw new ConvexError("Payment not found");
    }
    if (!payment.providerCheckoutId) {
      throw new ConvexError("Payment does not have a Rapyd checkout yet");
    }

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();

    const requestPath = `/v1/checkout/${payment.providerCheckoutId}`;
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const { response, responseText, signatureEncoding } = await executeRapydSignedGet({
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
        payload.status?.message ?? payload.status?.error_code ?? "Unknown error";
      throw new ConvexError(`Rapyd checkout lookup rejected: ${providerReason}`);
    }

    const checkoutStatusRaw = payload.data.status?.trim().toUpperCase();
    const paymentStatusRaw = payload.data.payment?.status?.trim().toUpperCase();
    const providerPaymentId = payload.data.payment?.id?.trim() || undefined;

    const reconcile = await ctx.runMutation(internal.payments.reconcilePaymentFromCheckoutLookup, {
      paymentId: payment._id,
      providerCheckoutId: payload.data.id,
      ...omitUndefined({
        providerPaymentId,
        checkoutStatusRaw,
        paymentStatusRaw,
      }),
    });

    const checkoutStatus =
      reconcile.paymentStatus === "captured"
        ? "completed"
        : reconcile.paymentStatus === "cancelled"
          ? "cancelled"
          : reconcile.paymentStatus === "failed" || reconcile.paymentStatus === "refunded"
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
    beneficiaryEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
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
      verificationContext.instructorProfile.diditVerificationStatus !== "approved"
    ) {
      throw new ConvexError(
        "Identity verification is required before payout onboarding. Complete Didit verification first.",
      );
    }

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();

    const beneficiaryCountry = resolveRapydCountry(
      args.beneficiaryCountry ?? process.env.RAPYD_COUNTRY,
    );
    const beneficiaryEntityType = args.beneficiaryEntityType ?? "individual";
    const category = (args.category ?? "bank").trim().toLowerCase();
    const payoutCurrency = resolvePaymentsCurrency(
      args.payoutCurrency ?? process.env.PAYMENTS_CURRENCY,
    );
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

    const merchantReferenceId = `beneficiary:${currentUser._id}:${crypto.randomUUID()}`;
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
      sender_country: resolveRapydCountry(),
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
        await ctx.runMutation(internal.payments.markBeneficiaryOnboardingSessionFailed, {
          sessionId: pendingSession._id,
          error: `Rapyd beneficiary onboarding HTTP ${response.status} [${signatureEncoding}]: ${text.slice(0, 400)}`,
        });
        throw new ConvexError(
          `Rapyd onboarding failed (HTTP ${response.status}) [${signatureEncoding}]: ${text.slice(0, 240)}`,
        );
      }

      const payload = JSON.parse(text) as {
        status?: { status?: string; message?: string; error_code?: string };
        data?: { redirect_url?: string; url?: string };
      };
      const redirectUrl = payload.data?.redirect_url?.trim() || payload.data?.url?.trim();
      if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !redirectUrl) {
        const reason =
          payload.status?.message ?? payload.status?.error_code ?? "Missing redirect_url";
        await ctx.runMutation(internal.payments.markBeneficiaryOnboardingSessionFailed, {
          sessionId: pendingSession._id,
          error: `Rapyd beneficiary onboarding rejected: ${reason}`,
        });
        throw new ConvexError(`Rapyd onboarding rejected: ${reason}`);
      }

      await ctx.runMutation(internal.payments.markBeneficiaryOnboardingSessionPending, {
        sessionId: pendingSession._id,
        redirectUrl,
      });

      return {
        onboardingId: pendingSession._id,
        redirectUrl,
        merchantReferenceId,
      };
    } catch (error) {
      await ctx.runMutation(internal.payments.markBeneficiaryOnboardingSessionFailed, {
        sessionId: pendingSession._id,
        error: error instanceof Error ? error.message : "onboarding_error",
      });
      throw error;
    }
  },
});
