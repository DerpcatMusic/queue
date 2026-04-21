import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentUser, requireUserRole } from "../lib/auth";
import { loadLatestConnectedAccountForUser } from "./helpers";
import { projectConnectedAccountLocal } from "./readShared";
import {
  connectedAccountOnboardingSummaryValidator,
  getPaymentsPreflightState,
} from "./validators";

export const getMyInstructorConnectedAccount = query({
  args: {},
  returns: v.union(v.null(), connectedAccountOnboardingSummaryValidator),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const account = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");
    return account ? projectConnectedAccountLocal(account as any) : null;
  },
});

export const getMyStudioConnectedAccount = query({
  args: {},
  returns: v.union(v.null(), connectedAccountOnboardingSummaryValidator),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const account = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");
    return account ? projectConnectedAccountLocal(account as any) : null;
  },
});

export const getPaymentsPreflight = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return getPaymentsPreflightState();
  },
});
