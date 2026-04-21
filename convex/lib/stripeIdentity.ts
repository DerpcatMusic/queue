import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type IdentityVerificationStatus =
  | "not_started"
  | "in_progress"
  | "pending"
  | "in_review"
  | "approved"
  | "declined"
  | "abandoned"
  | "expired";

export async function getLatestStripeConnectedAccount(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"connectedAccounts"> | null> {
  const accounts = await ctx.db
    .query("connectedAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  return accounts.find((account) => account.provider === "stripe") ?? null;
}

export function mapStripeConnectedAccountStatusToIdentityStatus(
  status: Doc<"connectedAccounts">["status"] | undefined,
): IdentityVerificationStatus {
  switch (status) {
    case "active":
      return "approved";
    case "pending":
      return "in_progress";
    case "action_required":
    case "restricted":
      return "pending";
    case "rejected":
    case "disabled":
      return "declined";
    default:
      return "not_started";
  }
}

export function isStripeIdentityVerified(
  account: Pick<Doc<"connectedAccounts">, "provider" | "status"> | null | undefined,
) {
  return account?.provider === "stripe" && account.status === "active";
}
