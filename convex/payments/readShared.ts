import { omitUndefined } from "../lib/validation";
import type { loadLatestConnectedAccountForUser } from "./helpers";

export async function getPaymentOrderById(
  ctx: { db: { get: (id: any) => Promise<any> } },
  paymentOrderId: string,
) {
  return await ctx.db.get(paymentOrderId as any);
}

export function projectConnectedAccountLocal(
  account: NonNullable<Awaited<ReturnType<typeof loadLatestConnectedAccountForUser>>>,
) {
  return {
    _id: account._id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    accountCapability: account.accountCapability,
    status: account.status,
    country: account.country,
    currency: account.currency,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    ...omitUndefined({
      activatedAt: account.activatedAt,
      requirementsSummary: account.metadata?.requirementsSummary,
    }),
  };
}
