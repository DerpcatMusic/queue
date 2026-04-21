import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { diditVerificationStatusValidator } from "../lib/instructorCompliance";
import { omitUndefined } from "../lib/validation";
import { type DiditBackfillBatchResult, requireMigrationsAccessToken } from "./shared";
import { ErrorCode } from "../lib/errors";

const DIDIT_BASE_URL = "https://verification.didit.me";
const DIDIT_STATUS_VALUES = [
  "not_started",
  "in_progress",
  "pending",
  "in_review",
  "approved",
  "declined",
  "abandoned",
  "expired",
] as const;
type DiditStatus = (typeof DIDIT_STATUS_VALUES)[number];

function normalizeDiditStatus(raw: string | undefined): DiditStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("approve")) return "approved";
  if (value.includes("declin")) return "declined";
  if (value.includes("abandon")) return "abandoned";
  if (value.includes("expir")) return "expired";
  if (value.includes("review")) return "in_review";
  if (value.includes("pending")) return "pending";
  if (value.includes("progress")) return "in_progress";
  return "not_started";
}

function normalizeNamePart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

function getTrimmedString(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function extractLegalName(decision: unknown): {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
} {
  if (!decision || typeof decision !== "object") {
    return {};
  }
  const rawDecision = decision as Record<string, unknown>;
  const idVerificationsRaw = rawDecision.id_verifications;
  const idVerification =
    Array.isArray(idVerificationsRaw) && idVerificationsRaw.length > 0
      ? ((idVerificationsRaw[0] as Record<string, unknown>) ?? {})
      : idVerificationsRaw && typeof idVerificationsRaw === "object"
        ? (idVerificationsRaw as Record<string, unknown>)
        : {};
  const idVerificationExtracted =
    idVerification.extracted_data && typeof idVerification.extracted_data === "object"
      ? (idVerification.extracted_data as Record<string, unknown>)
      : {};

  const firstName = normalizeNamePart(
    idVerification.first_name ??
      idVerification.firstName ??
      idVerificationExtracted.first_name ??
      idVerificationExtracted.firstName ??
      rawDecision.first_name,
  );
  const middleName = normalizeNamePart(
    idVerification.middle_name ??
      idVerification.middleName ??
      idVerificationExtracted.middle_name ??
      idVerificationExtracted.middleName ??
      rawDecision.middle_name,
  );
  const lastName = normalizeNamePart(
    idVerification.last_name ??
      idVerification.lastName ??
      idVerificationExtracted.last_name ??
      idVerificationExtracted.lastName ??
      rawDecision.last_name,
  );
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || undefined;
  return omitUndefined({ firstName, middleName, lastName, fullName });
}

export const backfillDiditVerificationSnapshots = action({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    onlyNonApproved: v.optional(v.boolean()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    synced: v.number(),
    skippedNoSession: v.number(),
    skippedAlreadyApproved: v.number(),
    failed: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const batchSize = Math.min(Math.max(args.batchSize ?? 50, 1), 100);
    const onlyNonApproved = args.onlyNonApproved ?? true;
    const diditApiKey = (process.env.DIDIT_API_KEY ?? "").trim();
    if (!diditApiKey) {
      throw new ConvexError({
        code: ErrorCode.MISSING_CONFIGURATION,
        message: "DIDIT_API_KEY is not configured",
      });
    }
    const diditBaseUrl = (process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL).trim();
    const page: DiditBackfillBatchResult = await ctx.runQuery(
      internal.migrations.index.getDiditBackfillInstructorBatch,
      {
        batchSize,
        ...omitUndefined({ cursor: args.cursor }),
      },
    );

    const fetchJson = async (url: string): Promise<Record<string, unknown> | undefined> => {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": diditApiKey,
        },
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as unknown;
      return payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : undefined;
    };

    let synced = 0;
    let skippedNoSession = 0;
    let skippedAlreadyApproved = 0;
    let failed = 0;
    const now = Date.now();

    for (const profile of page.page) {
      if (!profile.diditSessionId) {
        skippedNoSession += 1;
        continue;
      }
      if (onlyNonApproved && profile.diditVerificationStatus === "approved") {
        skippedAlreadyApproved += 1;
        continue;
      }

      try {
        const decisionUrl = new URL(
          `/v3/session/${profile.diditSessionId}/decision/`,
          diditBaseUrl,
        ).toString();
        const sessionUrl = new URL(
          `/v3/session/${profile.diditSessionId}/`,
          diditBaseUrl,
        ).toString();
        const decisionPayload = await fetchJson(decisionUrl);
        const sessionPayload = await fetchJson(sessionUrl);
        const decisionData =
          decisionPayload?.data && typeof decisionPayload.data === "object"
            ? (decisionPayload.data as Record<string, unknown>)
            : decisionPayload;
        const sessionData =
          sessionPayload?.data && typeof sessionPayload.data === "object"
            ? (sessionPayload.data as Record<string, unknown>)
            : sessionPayload;

        const statusRaw =
          getTrimmedString(decisionData, ["status"]) ??
          getTrimmedString(sessionData, ["status"]) ??
          profile.diditStatusRaw;
        const mappedStatus = normalizeDiditStatus(statusRaw);
        const decision = decisionData ?? profile.diditDecision;
        const legal = mappedStatus === "approved" ? extractLegalName(decision) : {};

        await ctx.runMutation(internal.migrations.index.applyDiditVerificationSnapshotCompat, {
          instructorId: profile.instructorId,
          mappedStatus,
          at: now,
          ...omitUndefined({
            statusRaw,
            decision,
            legalFirstName: legal.firstName,
            legalMiddleName: legal.middleName,
            legalLastName: legal.lastName,
            legalName: legal.fullName,
          }),
        });
        synced += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: page.page.length,
      synced,
      skippedNoSession,
      skippedAlreadyApproved,
      failed,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const applyDiditVerificationSnapshotCompat = internalMutation({
  args: {
    instructorId: v.id("instructorProfiles"),
    mappedStatus: diditVerificationStatusValidator,
    at: v.number(),
    statusRaw: v.optional(v.string()),
    decision: v.optional(v.any()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    legalName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      return null;
    }

    await ctx.db.patch(profile._id, {
      diditVerificationStatus: args.mappedStatus,
      diditStatusRaw: args.statusRaw,
      diditDecision: args.decision,
      diditVerifiedAt: args.at,
      diditLegalFirstName: args.legalFirstName,
      diditLegalMiddleName: args.legalMiddleName,
      diditLegalLastName: args.legalLastName,
      diditLegalName: args.legalName,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getDiditBackfillInstructorBatch = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    page: v.array(
      v.object({
        instructorId: v.id("instructorProfiles"),
        diditSessionId: v.optional(v.string()),
        diditVerificationStatus: v.optional(diditVerificationStatusValidator),
        diditStatusRaw: v.optional(v.string()),
        diditDecision: v.optional(v.any()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args): Promise<DiditBackfillBatchResult> => {
    const page = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: args.batchSize });
    return {
      page: page.page.map((profile) => ({
        instructorId: profile._id,
        ...omitUndefined({
          diditSessionId: profile.diditSessionId,
          diditVerificationStatus: profile.diditVerificationStatus,
          diditStatusRaw: profile.diditStatusRaw,
          diditDecision: profile.diditDecision,
        }),
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
