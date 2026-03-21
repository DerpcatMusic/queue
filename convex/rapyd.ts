"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import {
  executeRapydSignedGet,
  executeRapydSignedPost,
  extractRapydErrorCode,
  listRapydPaymentMethodsByCountry,
  resolveRapydCheckoutMethodSelection,
  resolveRapydRequestCredentials,
} from "./integrations/rapyd/client";
import {
  normalizeCurrencyCode,
  normalizeIsoCountryCode,
  resolveHostedPageUrl,
  resolvePaymentsCurrency,
  resolveRapydCountry,
  resolveRapydMode,
} from "./integrations/rapyd/config";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;
type RapydCheckoutMode = "a2a" | "flexible";

const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

const resolveRapydCheckoutMode = (): RapydCheckoutMode =>
  (process.env.RAPYD_CHECKOUT_MODE ?? "a2a").trim().toLowerCase() === "flexible"
    ? "flexible"
    : "a2a";

const requireSandboxRapydMode = () => {
  if (resolveRapydMode() !== "sandbox") {
    throw new ConvexError("This operation is only available in Rapyd sandbox mode");
  }
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

type VirtualAccountResult = {
  virtualAccountId: string;
  merchantReferenceId: string;
  ewallet: string;
  country: string;
  currency: string;
  requestedCurrency?: string;
  status?: string;
  bankAccount?: Record<string, unknown>;
  description?: string;
};

type VirtualAccountTransferResult = {
  virtualAccountId: string;
  transactionId?: string;
  currency: string;
  amount: number;
  requestedCurrency?: string;
  status?: string;
  bankAccount?: Record<string, unknown>;
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

const buildProviderMethodCacheKey = (
  kind: "payment_methods_country" | "payout_method_types" | "payout_required_fields",
  params: Record<string, string | number | undefined>,
): string =>
  `${kind}:${Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&")}`;

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
    const checkoutMode = resolveRapydCheckoutMode();
    const configuredMethods =
      process.env.RAPYD_PAYMENT_METHODS?.trim() ||
      (checkoutMode === "a2a" ? "bank_transfer,bank_redirect" : undefined);
    const checkoutMethodSelection = await resolveRapydCheckoutMethodSelection({
      configured: configuredMethods,
      country,
      currency,
      accessKey,
      secretKey,
      baseUrl: rapydBaseUrl,
      allowedCategories: checkoutMode === "a2a" ? ["bank_transfer", "bank_redirect"] : undefined,
    });
    if (checkoutMethodSelection.warnings.length > 0) {
      throw new ConvexError(checkoutMethodSelection.warnings.join(" | "));
    }

    const effectiveIdempotencyKey = `${RAPYD_PROVIDER}:${user._id}:${job._id}:${crypto.randomUUID()}`;
    let pendingPayment: { _id: Id<"payments"> } | null = null;

    try {
      const paymentOrder = await ctx.runMutation(internal.payments.createPaymentOrder, {
        jobId: job._id,
        studioId: studio._id,
        studioUserId: user._id,
        instructorId: instructorProfile._id,
        instructorUserId: instructorProfile.userId,
        provider: RAPYD_PROVIDER,
        currency,
        instructorGrossAmountAgorot: instructorBaseAmountAgorot,
        platformFeeAmountAgorot: platformMarkupAmountAgorot,
        studioChargeAmountAgorot,
        platformFeeBps: markupBps,
      });
      if (!paymentOrder?._id) {
        throw new ConvexError("Failed to create payment order");
      }

      pendingPayment = (await ctx.runMutation(internal.payments.createPendingPayment, {
        paymentOrderId: paymentOrder._id,
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
        merchant_reference_id: paymentOrder.correlationToken,
        metadata: {
          paymentId: pendingPayment._id,
          paymentOrderId: paymentOrder._id,
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
        checkoutUrl:
          payload.data.redirect_url ?? payload.data.complete_checkout_url ?? completeCheckoutUrl,
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

export const listAvailablePaymentMethods = action({
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      type: v.string(),
      category: v.optional(v.string()),
      paymentFlowType: v.optional(v.string()),
      supportedDigitalWalletProviders: v.array(v.string()),
      status: v.optional(v.number()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      type: string;
      category?: string;
      paymentFlowType?: string;
      supportedDigitalWalletProviders: string[];
      status?: number;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const country = resolveRapydCountry(args.country);
    const currency = resolvePaymentsCurrency(args.currency);
    const cacheKey = buildProviderMethodCacheKey("payment_methods_country", {
      country,
      currency,
    });
    const cached = (await ctx.runQuery(internal.payments.getProviderMethodCache, {
      kind: "payment_methods_country",
      cacheKey,
    })) as {
      expiresAt: number;
      payload: {
        methods?: Array<{
          type: string;
          category?: string;
          paymentFlowType?: string;
          supportedDigitalWalletProviders?: string[];
          status?: string | number;
        }>;
      };
    } | null;
    if (cached && cached.expiresAt > Date.now() && cached.payload.methods) {
      return cached.payload.methods.map(
        (method: (typeof cached.payload.methods)[number]) =>
          omitUndefined({
            type: method.type,
            category: method.category,
            paymentFlowType: method.paymentFlowType,
            supportedDigitalWalletProviders: method.supportedDigitalWalletProviders ?? [],
            status: typeof method.status === "number" ? method.status : undefined,
          }) as {
            type: string;
            category?: string;
            paymentFlowType?: string;
            supportedDigitalWalletProviders: string[];
            status?: number;
          },
      );
    }

    const { accessKey, secretKey, baseUrl } = resolveRapydRequestCredentials();
    const methods = await listRapydPaymentMethodsByCountry({
      accessKey,
      secretKey,
      baseUrl,
      country,
      currency,
    });
    await ctx.runMutation(internal.payments.upsertProviderMethodCache, {
      kind: "payment_methods_country",
      cacheKey,
      country,
      currency,
      methods: methods.map((method) => ({
        type: method.type,
        ...omitUndefined({
          category: method.category,
          paymentFlowType: method.paymentFlowType,
          supportedDigitalWalletProviders: method.supportedDigitalWalletProviders,
          status: method.status,
        }),
      })) as any,
    });
    return methods;
  },
});

export const listAvailablePayoutMethodTypes = action({
  args: {
    beneficiaryCountry: v.string(),
    payoutCurrency: v.string(),
    category: v.optional(v.string()),
    beneficiaryEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    senderCountry: v.optional(v.string()),
    senderCurrency: v.optional(v.string()),
    senderEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
  },
  returns: v.array(
    v.object({
      payoutMethodType: v.string(),
      name: v.optional(v.string()),
      category: v.optional(v.string()),
      status: v.optional(v.union(v.string(), v.number())),
      countries: v.optional(v.array(v.string())),
      currencies: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      payoutMethodType: string;
      name?: string;
      category?: string;
      status?: string | number;
      countries?: string[];
      currencies?: string[];
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const beneficiaryCountry = normalizeIsoCountryCode(
      args.beneficiaryCountry,
      "beneficiaryCountry",
    );
    const payoutCurrency = normalizeCurrencyCode(args.payoutCurrency, "payoutCurrency");
    const category = (args.category ?? "bank").trim().toLowerCase();
    const senderCountry = resolveRapydCountry(args.senderCountry);
    const senderCurrency = resolvePaymentsCurrency(args.senderCurrency);
    const senderEntityType = args.senderEntityType ?? "company";
    const beneficiaryEntityType = args.beneficiaryEntityType ?? "individual";
    const cacheKey = buildProviderMethodCacheKey("payout_method_types", {
      beneficiaryCountry,
      payoutCurrency,
      category,
      senderCountry,
      senderCurrency,
      senderEntityType,
      beneficiaryEntityType,
    });
    const cached = (await ctx.runQuery(internal.payments.getProviderMethodCache, {
      kind: "payout_method_types",
      cacheKey,
    })) as {
      expiresAt: number;
      payload: {
        methods?: Array<{
          type: string;
          payoutMethodType?: string;
          name?: string;
          category?: string;
          status?: string | number;
          countries?: string[];
          currencies?: string[];
        }>;
      };
    } | null;
    if (cached && cached.expiresAt > Date.now() && cached.payload.methods) {
      return cached.payload.methods.map(
        (method: (typeof cached.payload.methods)[number]) =>
          omitUndefined({
            payoutMethodType: method.payoutMethodType ?? method.type,
            name: method.name,
            category: method.category,
            status: method.status,
            countries: method.countries,
            currencies: method.currencies,
          }) as {
            payoutMethodType: string;
            name?: string;
            category?: string;
            status?: string | number;
            countries?: string[];
            currencies?: string[];
          },
      );
    }

    const { accessKey, secretKey, baseUrl } = resolveRapydRequestCredentials();
    const params = new URLSearchParams({
      beneficiary_country: beneficiaryCountry,
      payout_currency: payoutCurrency,
      category,
      sender_country: senderCountry,
      sender_currency: senderCurrency,
      sender_entity_type: senderEntityType,
      beneficiary_entity_type: beneficiaryEntityType,
    });
    const requestPath = `/v1/payout_method_types?${params.toString()}`;
    const requestUrl = new URL(requestPath, `${baseUrl}/`);
    const { response, responseText, signatureEncoding } = await executeRapydSignedGet({
      url: requestUrl.toString(),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      accessKey,
      secretKey,
    });
    if (!response.ok) {
      throw new ConvexError(
        `Rapyd payout method lookup failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseText.slice(0, 300)}`,
      );
    }
    const payload = JSON.parse(responseText) as {
      status?: { status?: string; message?: string; error_code?: string };
      data?: Array<{
        payout_method_type?: string;
        name?: string;
        category?: string;
        status?: string | number;
        beneficiary_countries?: string[];
        payout_currencies?: string[];
      }>;
    };
    if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !Array.isArray(payload.data)) {
      throw new ConvexError(
        `Rapyd payout method lookup rejected: ${payload.status?.message ?? payload.status?.error_code ?? "Unknown error"}`,
      );
    }
    const methods: Array<{
      payoutMethodType: string;
      name?: string;
      category?: string;
      status?: string | number;
      countries?: string[];
      currencies?: string[];
    }> = payload.data
      .filter((row) => typeof row.payout_method_type === "string" && row.payout_method_type.trim())
      .map(
        (row) =>
          omitUndefined({
            payoutMethodType: row.payout_method_type!.trim(),
            name: row.name?.trim(),
            category: row.category?.trim(),
            status: row.status,
            countries: row.beneficiary_countries,
            currencies: row.payout_currencies,
          }) as {
            payoutMethodType: string;
            name?: string;
            category?: string;
            status?: string | number;
            countries?: string[];
            currencies?: string[];
          },
      );
    await ctx.runMutation(internal.payments.upsertProviderMethodCache, {
      kind: "payout_method_types",
      cacheKey,
      country: beneficiaryCountry,
      currency: payoutCurrency,
      methods: methods.map((method) => ({
        type: method.payoutMethodType,
        ...omitUndefined({
          payoutMethodType: method.payoutMethodType,
          name: method.name,
          category: method.category,
          status: method.status,
          countries: method.countries,
          currencies: method.currencies,
        }),
      })) as any,
    });
    return methods;
  },
});

export const getPayoutRequiredFields = action({
  args: {
    payoutMethodType: v.string(),
    beneficiaryCountry: v.string(),
    payoutCurrency: v.string(),
    payoutAmount: v.number(),
    beneficiaryEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    senderCountry: v.optional(v.string()),
    senderCurrency: v.optional(v.string()),
    senderEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      type: v.optional(v.string()),
      required: v.optional(v.boolean()),
      description: v.optional(v.string()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      name: string;
      type?: string;
      required?: boolean;
      description?: string;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const payoutMethodType = args.payoutMethodType.trim().toLowerCase();
    const beneficiaryCountry = normalizeIsoCountryCode(
      args.beneficiaryCountry,
      "beneficiaryCountry",
    );
    const payoutCurrency = normalizeCurrencyCode(args.payoutCurrency, "payoutCurrency");
    const senderCountry = resolveRapydCountry(args.senderCountry);
    const senderCurrency = resolvePaymentsCurrency(args.senderCurrency);
    const senderEntityType = args.senderEntityType ?? "company";
    const beneficiaryEntityType = args.beneficiaryEntityType ?? "individual";
    const payoutAmount = Math.max(1, Math.round(args.payoutAmount));
    const cacheKey = buildProviderMethodCacheKey("payout_required_fields", {
      payoutMethodType,
      beneficiaryCountry,
      payoutCurrency,
      payoutAmount,
      beneficiaryEntityType,
      senderCountry,
      senderCurrency,
      senderEntityType,
    });
    const cached = (await ctx.runQuery(internal.payments.getProviderMethodCache, {
      kind: "payout_required_fields",
      cacheKey,
    })) as {
      expiresAt: number;
      payload: {
        requiredFields?: Array<{
          name: string;
          type?: string;
          required?: boolean;
          description?: string;
        }>;
      };
    } | null;
    if (cached && cached.expiresAt > Date.now() && cached.payload.requiredFields) {
      return cached.payload.requiredFields;
    }

    const { accessKey, secretKey, baseUrl } = resolveRapydRequestCredentials();
    const params = new URLSearchParams({
      beneficiary_country: beneficiaryCountry,
      beneficiary_entity_type: beneficiaryEntityType,
      payout_amount: String(payoutAmount),
      payout_currency: payoutCurrency,
      sender_country: senderCountry,
      sender_currency: senderCurrency,
      sender_entity_type: senderEntityType,
    });
    const requestPath = `/v1/payout_methods/${payoutMethodType}/required_fields?${params.toString()}`;
    const requestUrl = new URL(requestPath, `${baseUrl}/`);
    const { response, responseText, signatureEncoding } = await executeRapydSignedGet({
      url: requestUrl.toString(),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      accessKey,
      secretKey,
    });
    if (!response.ok) {
      throw new ConvexError(
        `Rapyd payout field lookup failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseText.slice(0, 300)}`,
      );
    }
    const payload = JSON.parse(responseText) as {
      status?: { status?: string; message?: string; error_code?: string };
      data?: {
        beneficiary_required_fields?: Array<{
          name?: string;
          type?: string;
          required?: boolean;
          description?: string;
        }>;
        sender_required_fields?: Array<{
          name?: string;
          type?: string;
          required?: boolean;
          description?: string;
        }>;
      };
    };
    if ((payload.status?.status ?? "ERROR") !== "SUCCESS") {
      throw new ConvexError(
        `Rapyd payout field lookup rejected: ${payload.status?.message ?? payload.status?.error_code ?? "Unknown error"}`,
      );
    }
    const requiredFields: Array<{
      name: string;
      type?: string;
      required?: boolean;
      description?: string;
    }> = [
      ...(payload.data?.beneficiary_required_fields ?? []),
      ...(payload.data?.sender_required_fields ?? []),
    ]
      .filter((row) => typeof row.name === "string" && row.name.trim())
      .map(
        (row) =>
          omitUndefined({
            name: row.name!.trim(),
            type: row.type?.trim(),
            required: row.required,
            description: row.description?.trim(),
          }) as {
            name: string;
            type?: string;
            required?: boolean;
            description?: string;
          },
      );
    await ctx.runMutation(internal.payments.upsertProviderMethodCache, {
      kind: "payout_required_fields",
      cacheKey,
      country: beneficiaryCountry,
      currency: payoutCurrency,
      requiredFields,
    });
    return requiredFields;
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

export const createSandboxVirtualAccountForEwallet = action({
  args: {
    ewallet: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    requestedCurrency: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    virtualAccountId: v.string(),
    merchantReferenceId: v.string(),
    ewallet: v.string(),
    country: v.string(),
    currency: v.string(),
    requestedCurrency: v.optional(v.string()),
    status: v.optional(v.string()),
    bankAccount: v.optional(v.record(v.string(), v.any())),
    description: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<VirtualAccountResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    requireSandboxRapydMode();

    const ewallet = (args.ewallet ?? process.env.RAPYD_EWALLET ?? "").trim();
    if (!ewallet) {
      throw new ConvexError("Missing RAPYD_EWALLET");
    }

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();
    const country = resolveRapydCountry(args.country ?? process.env.RAPYD_COUNTRY);
    const currency = resolvePaymentsCurrency(args.currency ?? process.env.PAYMENTS_CURRENCY);
    const requestedCurrency = args.requestedCurrency?.trim() || undefined;
    const merchantReferenceId = `virtual_account:${ewallet}:${crypto.randomUUID()}`;
    const requestPath = "/v1/virtual_accounts";
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const bodyPayload: Record<string, unknown> = {
      ewallet,
      country,
      currency,
      description: args.description?.trim() || "Sandbox virtual account for wallet",
      merchant_reference_id: merchantReferenceId,
      ...omitUndefined({
        requested_currency: requestedCurrency,
      }),
    };

    const body = JSON.stringify(bodyPayload);
    const { response, responseText, signatureEncoding } = await executeRapydSignedPost({
      url: requestUrl.toString(),
      path: requestUrl.pathname,
      accessKey,
      secretKey,
      idempotency: merchantReferenceId,
      body,
    });
    if (!response.ok) {
      throw new ConvexError(
        `Rapyd virtual account issue failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseText.slice(0, 400)}`,
      );
    }

    const payload = JSON.parse(responseText) as {
      status?: { status?: string; message?: string; error_code?: string };
      data?: {
        id?: string;
        merchant_reference_id?: string;
        ewallet?: string;
        currency?: string;
        requested_currency?: string;
        status?: string;
        description?: string;
        bank_account?: Record<string, unknown>;
      };
    };
    if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !payload.data?.id) {
      throw new ConvexError(
        `Rapyd virtual account issue rejected: ${payload.status?.message ?? payload.status?.error_code ?? "Unknown error"}`,
      );
    }

    return omitUndefined({
      virtualAccountId: payload.data.id,
      merchantReferenceId: payload.data.merchant_reference_id ?? merchantReferenceId,
      ewallet: payload.data.ewallet ?? ewallet,
      country,
      currency: payload.data.currency ?? currency,
      requestedCurrency: payload.data.requested_currency,
      status: payload.data.status,
      bankAccount: payload.data.bank_account,
      description: payload.data.description,
    }) as VirtualAccountResult;
  },
});

export const listSandboxVirtualAccountsForEwallet = action({
  args: {
    ewallet: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      virtualAccountId: v.string(),
      merchantReferenceId: v.optional(v.string()),
      ewallet: v.optional(v.string()),
      currency: v.optional(v.string()),
      requestedCurrency: v.optional(v.string()),
      status: v.optional(v.string()),
      bankAccount: v.optional(v.record(v.string(), v.any())),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    requireSandboxRapydMode();

    const ewallet = (args.ewallet ?? process.env.RAPYD_EWALLET ?? "").trim();
    if (!ewallet) {
      throw new ConvexError("Missing RAPYD_EWALLET");
    }

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();
    const requestPath = `/v1/ewallets/${ewallet}/virtual_accounts`;
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const { response, responseText, signatureEncoding } = await executeRapydSignedGet({
      url: requestUrl.toString(),
      path: requestUrl.pathname,
      accessKey,
      secretKey,
    });
    if (!response.ok) {
      throw new ConvexError(
        `Rapyd virtual account list failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseText.slice(0, 400)}`,
      );
    }

    const payload = JSON.parse(responseText) as {
      status?: { status?: string; message?: string; error_code?: string };
      data?: Array<{
        id?: string;
        merchant_reference_id?: string;
        ewallet?: string;
        currency?: string;
        requested_currency?: string;
        status?: string;
        bank_account?: Record<string, unknown>;
      }>;
    };
    if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !Array.isArray(payload.data)) {
      throw new ConvexError(
        `Rapyd virtual account list rejected: ${payload.status?.message ?? payload.status?.error_code ?? "Unknown error"}`,
      );
    }

    return payload.data
      .filter((row) => typeof row.id === "string" && row.id.trim().length > 0)
      .map(
        (row) =>
          omitUndefined({
            virtualAccountId: row.id!.trim(),
            merchantReferenceId: row.merchant_reference_id?.trim(),
            ewallet: row.ewallet?.trim(),
            currency: row.currency?.trim(),
            requestedCurrency: row.requested_currency?.trim(),
            status: row.status?.trim(),
            bankAccount: row.bank_account,
          }) as {
            virtualAccountId: string;
            merchantReferenceId?: string;
            ewallet?: string;
            currency?: string;
            requestedCurrency?: string;
            status?: string;
            bankAccount?: Record<string, unknown>;
          },
      );
  },
});

export const simulateSandboxVirtualAccountTransfer = action({
  args: {
    virtualAccountId: v.string(),
    amount: v.number(),
    currency: v.string(),
    requestedCurrency: v.optional(v.string()),
    remitterReference: v.optional(v.string()),
    accountName: v.optional(v.string()),
  },
  returns: v.object({
    virtualAccountId: v.string(),
    transactionId: v.optional(v.string()),
    currency: v.string(),
    amount: v.number(),
    requestedCurrency: v.optional(v.string()),
    status: v.optional(v.string()),
    bankAccount: v.optional(v.record(v.string(), v.any())),
  }),
  handler: async (ctx, args): Promise<VirtualAccountTransferResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    requireSandboxRapydMode();

    const { accessKey, secretKey, baseUrl: rapydBaseUrl } = resolveRapydRequestCredentials();
    const amount = Number(Math.max(0, args.amount).toFixed(2));
    const requestPath = "/v1/virtual_accounts/transactions";
    const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
    const bodyPayload: Record<string, unknown> = {
      issued_bank_account: args.virtualAccountId,
      amount: String(amount),
      currency: args.currency.trim().toUpperCase(),
      ...omitUndefined({
        requested_currency: args.requestedCurrency?.trim().toUpperCase(),
      }),
      ...(args.remitterReference || args.accountName
        ? {
            remitter_information: omitUndefined({
              remitter_reference: args.remitterReference?.trim(),
              account_name: args.accountName?.trim(),
            }),
          }
        : {}),
    };

    const body = JSON.stringify(bodyPayload);
    const idempotency = `virtual_account_transfer:${args.virtualAccountId}:${crypto.randomUUID()}`;
    const { response, responseText, signatureEncoding } = await executeRapydSignedPost({
      url: requestUrl.toString(),
      path: requestUrl.pathname,
      accessKey,
      secretKey,
      idempotency,
      body,
    });
    if (!response.ok) {
      throw new ConvexError(
        `Rapyd virtual account transfer failed (HTTP ${response.status}) [${signatureEncoding}]: ${responseText.slice(0, 400)}`,
      );
    }

    const payload = JSON.parse(responseText) as {
      status?: { status?: string; message?: string; error_code?: string };
      data?: {
        id?: string;
        currency?: string;
        requested_currency?: string;
        status?: string;
        bank_account?: Record<string, unknown>;
        transactions?: Array<{ id?: string }>;
      };
    };
    if ((payload.status?.status ?? "ERROR") !== "SUCCESS" || !payload.data?.id) {
      throw new ConvexError(
        `Rapyd virtual account transfer rejected: ${payload.status?.message ?? payload.status?.error_code ?? "Unknown error"}`,
      );
    }

    return omitUndefined({
      virtualAccountId: payload.data.id,
      transactionId: payload.data.transactions?.[0]?.id,
      currency: payload.data.currency ?? args.currency.trim().toUpperCase(),
      amount,
      requestedCurrency: payload.data.requested_currency,
      status: payload.data.status,
      bankAccount: payload.data.bank_account,
    }) as VirtualAccountTransferResult;
  },
});
