import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { omitUndefined } from "./lib/validation";

type InvoiceProvider = "icount" | "morning";

type InvoicingContext = {
  payment: {
    _id: Id<"payments">;
    status: "created" | "pending" | "authorized" | "captured" | "failed" | "cancelled" | "refunded";
    currency: string;
    studioChargeAmountAgorot: number;
  };
  studioUser: {
    _id: Id<"users">;
    fullName?: string;
    email?: string;
  } | null;
  job: {
    _id: Id<"jobs">;
    sport: string;
    startTime: number;
  } | null;
};
type InvoiceIssueResult =
  | { skipped: true; reason: "payment_not_captured" | "already_issued"; invoiceId?: Id<"invoices"> }
  | {
      success: true;
      invoiceId: Id<"invoices">;
      provider: InvoiceProvider;
      externalInvoiceId: string;
    };

const toAmount = (amountAgorot: number): number => Number((amountAgorot / 100).toFixed(2));

const normalizeBaseUrl = (raw: string, provider: InvoiceProvider): string => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${provider} base URL must be a valid absolute URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${provider} base URL must use https`);
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
};

const resolveInvoiceProvider = (): InvoiceProvider => {
  const provider = (process.env.INVOICE_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "icount" || provider === "morning") {
    return provider;
  }
  throw new Error("INVOICE_PROVIDER must be set to 'icount' or 'morning'");
};

const issueMorningInvoice = async ({
  paymentId,
  invoiceId,
  amountAgorot,
  currency,
  customerName,
  customerEmail,
  description,
}: {
  paymentId: string;
  invoiceId: string;
  amountAgorot: number;
  currency: string;
  customerName: string;
  customerEmail: string | undefined;
  description: string;
}): Promise<{ externalInvoiceId: string; externalInvoiceUrl: string | undefined }> => {
  const apiBaseRaw = (process.env.MORNING_API_BASE_URL ?? "").trim();
  const token = (process.env.MORNING_API_TOKEN ?? "").trim();
  if (!apiBaseRaw || !token) {
    throw new Error("MORNING_API_BASE_URL and MORNING_API_TOKEN are required");
  }
  const apiBase = normalizeBaseUrl(apiBaseRaw, "morning");

  const response = await fetch(`${apiBase}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      external_reference: paymentId,
      currency,
      amount: toAmount(amountAgorot),
      customer: {
        name: customerName,
        email: customerEmail,
      },
      items: [
        {
          description,
          quantity: 1,
          unit_price: toAmount(amountAgorot),
        },
      ],
      metadata: { invoiceId },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Morning API HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as {
    id?: string;
    url?: string;
    data?: { id?: string; url?: string };
  };
  const externalInvoiceId = payload.id ?? payload.data?.id ?? `${paymentId}-morning`;
  return {
    externalInvoiceId,
    externalInvoiceUrl: payload.url ?? payload.data?.url,
  };
};

const issueIcountInvoice = async ({
  paymentId,
  invoiceId,
  amountAgorot,
  currency,
  customerName,
  customerEmail,
  description,
}: {
  paymentId: string;
  invoiceId: string;
  amountAgorot: number;
  currency: string;
  customerName: string;
  customerEmail: string | undefined;
  description: string;
}): Promise<{ externalInvoiceId: string; externalInvoiceUrl: string | undefined }> => {
  const apiBaseRaw = (process.env.ICOUNT_API_BASE_URL ?? "").trim();
  const apiKey = (process.env.ICOUNT_API_KEY ?? "").trim();
  if (!apiBaseRaw || !apiKey) {
    throw new Error("ICOUNT_API_BASE_URL and ICOUNT_API_KEY are required");
  }
  const apiBase = normalizeBaseUrl(apiBaseRaw, "icount");

  const response = await fetch(`${apiBase}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      external_reference: paymentId,
      currency_code: currency,
      customer_name: customerName,
      customer_email: customerEmail,
      items: [
        {
          description,
          quantity: 1,
          unit_price: toAmount(amountAgorot),
        },
      ],
      metadata: { invoiceId },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`iCount API HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as {
    id?: string;
    url?: string;
    data?: { id?: string; url?: string };
  };
  const externalInvoiceId = payload.id ?? payload.data?.id ?? `${paymentId}-icount`;
  return {
    externalInvoiceId,
    externalInvoiceUrl: payload.url ?? payload.data?.url,
  };
};

export const issueInvoiceForPayment = internalAction({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }): Promise<InvoiceIssueResult> => {
    const context = (await ctx.runQuery(internal.payments.getPaymentForInvoicing, {
      paymentId,
    })) as InvoicingContext | null;
    if (!context?.payment || !context.job) {
      throw new Error("Missing payment context for invoicing");
    }
    if (context.payment.status !== "captured") {
      return { skipped: true, reason: "payment_not_captured" as const };
    }

    const provider = resolveInvoiceProvider();
    const invoice = (await ctx.runMutation(internal.payments.createInvoiceRecord, {
      paymentId,
      provider,
      currency: context.payment.currency,
      amountAgorot: context.payment.studioChargeAmountAgorot,
      vatRate: Number.parseFloat(process.env.INVOICE_DEFAULT_VAT_RATE ?? "18"),
    })) as { _id: Id<"invoices">; status: "pending" | "issued" | "failed" } | null;
    if (!invoice) {
      throw new Error("Failed to create invoice record");
    }
    if (invoice.status === "issued") {
      return { skipped: true, reason: "already_issued" as const, invoiceId: invoice._id };
    }

    const customerName =
      context.studioUser?.fullName?.trim() ||
      context.studioUser?.email?.trim() ||
      "QuickFit Studio";
    const description = `QuickFit lesson ${context.job.sport} ${new Date(
      context.job.startTime,
    ).toISOString()}`;

    try {
      const issued =
        provider === "morning"
          ? await issueMorningInvoice({
              paymentId: String(paymentId),
              invoiceId: String(invoice._id),
              amountAgorot: context.payment.studioChargeAmountAgorot,
              currency: context.payment.currency,
              customerName,
              customerEmail: context.studioUser?.email,
              description,
            })
          : await issueIcountInvoice({
              paymentId: String(paymentId),
              invoiceId: String(invoice._id),
              amountAgorot: context.payment.studioChargeAmountAgorot,
              currency: context.payment.currency,
              customerName,
              customerEmail: context.studioUser?.email,
              description,
            });

      await ctx.runMutation(internal.payments.markInvoiceIssued, {
        invoiceId: invoice._id,
        externalInvoiceId: issued.externalInvoiceId,
        ...omitUndefined({
          externalInvoiceUrl: issued.externalInvoiceUrl,
        }),
      });
      return {
        success: true,
        invoiceId: invoice._id,
        provider,
        externalInvoiceId: issued.externalInvoiceId,
      };
    } catch (error) {
      await ctx.runMutation(internal.payments.markInvoiceFailed, {
        invoiceId: invoice._id,
        error: error instanceof Error ? error.message : "Unknown invoice error",
      });
      throw error;
    }
  },
});
