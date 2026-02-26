import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserRole } from "./lib/auth";
import { omitUndefined } from "./lib/validation";

const DIDIT_BASE_URL = "https://verification.didit.me";

type DiditStatus =
  | "not_started"
  | "in_progress"
  | "pending"
  | "in_review"
  | "approved"
  | "declined"
  | "abandoned"
  | "expired";

const diditStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("pending"),
  v.literal("in_review"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("abandoned"),
  v.literal("expired"),
);

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConvexError(`Missing required environment variable: ${name}`);
  }
  return value;
};

const normalizeDiditStatus = (raw: string | undefined): DiditStatus => {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("approve")) return "approved";
  if (value.includes("declin")) return "declined";
  if (value.includes("abandon")) return "abandoned";
  if (value.includes("expir")) return "expired";
  if (value.includes("review")) return "in_review";
  if (value.includes("pending")) return "pending";
  if (value.includes("progress")) return "in_progress";
  return "not_started";
};

const normalizeNamePart = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
};

const getTrimmedString = (
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
};

const extractLegalName = (
  decision: unknown,
): { firstName?: string; lastName?: string; fullName?: string } => {
  if (!decision || typeof decision !== "object") {
    return {};
  }
  const rawDecision = decision as Record<string, unknown>;
  const idVerification =
    rawDecision.id_verifications && typeof rawDecision.id_verifications === "object"
      ? (rawDecision.id_verifications as Record<string, unknown>)
      : {};

  const firstName = normalizeNamePart(
    idVerification.first_name ?? idVerification.firstName ?? rawDecision.first_name,
  );
  const lastName = normalizeNamePart(
    idVerification.last_name ?? idVerification.lastName ?? rawDecision.last_name,
  );
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    ...omitUndefined({
      firstName,
      lastName,
      fullName: combined.length > 0 ? combined : undefined,
    }),
  };
};

const ensureUrl = (raw: string): string => {
  try {
    return new URL(raw).toString();
  } catch {
    throw new ConvexError("Invalid DIDIT_BASE_URL");
  }
};

export const getCurrentInstructorVerificationContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!instructorProfile) {
      return null;
    }
    return {
      user,
      instructorProfile,
    };
  },
});

export const createSessionForCurrentInstructor = action({
  args: {
    callback: v.optional(v.string()),
  },
  returns: v.object({
    sessionId: v.string(),
    sessionToken: v.string(),
    verificationUrl: v.string(),
    status: diditStatusValidator,
  }),
  handler: async (ctx, args) => {
    const verificationContext = await ctx.runQuery(
      internal.didit.getCurrentInstructorVerificationContext,
      {},
    );
    if (!verificationContext) {
      throw new ConvexError("Instructor profile not found");
    }

    const diditApiKey = getRequiredEnv("DIDIT_API_KEY");
    const workflowId = getRequiredEnv("DIDIT_WORKFLOW_ID");
    const diditBaseUrl = ensureUrl(process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL);
    const endpoint = new URL("/v3/session/", diditBaseUrl).toString();

    const requestBody = {
      workflow_id: workflowId,
      vendor_data: String(verificationContext.user._id),
      ...omitUndefined({
        callback: args.callback?.trim() ? args.callback.trim() : undefined,
      }),
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": diditApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new ConvexError(
        `Didit session creation failed (HTTP ${response.status}): ${responseText.slice(0, 240)}`,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      throw new ConvexError("Didit session creation returned invalid JSON");
    }

    const rootPayload =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined;
    const dataPayload =
      rootPayload?.data && typeof rootPayload.data === "object"
        ? (rootPayload.data as Record<string, unknown>)
        : undefined;

    const sessionId =
      getTrimmedString(rootPayload, ["session_id", "sessionId", "id"]) ??
      getTrimmedString(dataPayload, ["session_id", "sessionId", "id"]);
    const sessionToken =
      getTrimmedString(rootPayload, ["session_token", "sessionToken", "token"]) ??
      getTrimmedString(dataPayload, ["session_token", "sessionToken", "token"]);
    const verificationUrl =
      getTrimmedString(rootPayload, ["verification_url", "verificationUrl", "url"]) ??
      getTrimmedString(dataPayload, ["verification_url", "verificationUrl", "url"]);
    const statusRaw =
      getTrimmedString(rootPayload, ["status"]) ?? getTrimmedString(dataPayload, ["status"]);

    if (!sessionId || !sessionToken || !verificationUrl) {
      const topLevelKeys = rootPayload ? Object.keys(rootPayload).join(",") : "none";
      throw new ConvexError(
        `Didit session creation response is missing required fields (keys: ${topLevelKeys})`,
      );
    }

    const status = normalizeDiditStatus(statusRaw);
    await ctx.runMutation(internal.didit.recordDiditSessionStart, {
      instructorId: verificationContext.instructorProfile._id,
      sessionId,
      mappedStatus: status,
      ...omitUndefined({
        statusRaw,
      }),
    });

    return {
      sessionId,
      sessionToken,
      verificationUrl,
      status,
    };
  },
});

export const getMyDiditVerification = query({
  args: {},
  returns: v.union(
    v.object({
      status: diditStatusValidator,
      isVerified: v.boolean(),
      sessionId: v.optional(v.string()),
      legalName: v.optional(v.string()),
      lastEventAt: v.optional(v.number()),
      verifiedAt: v.optional(v.number()),
      decision: v.optional(v.any()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) {
      return null;
    }
    return {
      status: profile.diditVerificationStatus ?? "not_started",
      isVerified:
        profile.diditVerificationStatus === "approved" && Boolean(profile.diditLegalName?.trim()),
      ...omitUndefined({
        sessionId: profile.diditSessionId,
        legalName: profile.diditLegalName,
        lastEventAt: profile.diditLastEventAt,
        verifiedAt: profile.diditVerifiedAt,
        decision: profile.diditDecision,
      }),
    };
  },
});

export const recordDiditSessionStart = internalMutation({
  args: {
    instructorId: v.id("instructorProfiles"),
    sessionId: v.string(),
    statusRaw: v.optional(v.string()),
    mappedStatus: diditStatusValidator,
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      throw new ConvexError("Instructor profile not found");
    }
    await ctx.db.patch(profile._id, {
      diditSessionId: args.sessionId,
      diditVerificationStatus: args.mappedStatus,
      diditStatusRaw: args.statusRaw,
      diditLastEventAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const processDiditWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    sessionId: v.optional(v.string()),
    statusRaw: v.optional(v.string()),
    vendorData: v.optional(v.string()),
    decision: v.optional(v.any()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("diditEvents")
      .withIndex("by_provider_event_id", (q) => q.eq("providerEventId", args.providerEventId))
      .unique();
    if (existingEvent) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const mappedStatus = normalizeDiditStatus(args.statusRaw);
    const now = Date.now();
    const eventId = await ctx.db.insert("diditEvents", {
      providerEventId: args.providerEventId,
      signatureValid: args.signatureValid,
      processed: false,
      payloadHash: args.payloadHash,
      payload: args.payload,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        sessionId: args.sessionId,
        statusRaw: args.statusRaw,
        vendorData: args.vendorData,
        mappedStatus,
      }),
    });

    if (!args.signatureValid) {
      await ctx.db.patch(eventId, {
        processingError: "invalid_signature",
        updatedAt: Date.now(),
      });
      return { ignored: true, reason: "invalid_signature" as const };
    }

    let profile = null;
    if (args.sessionId) {
      profile = await ctx.db
        .query("instructorProfiles")
        .withIndex("by_didit_session_id", (q) => q.eq("diditSessionId", args.sessionId))
        .unique();
    }
    if (!profile && args.vendorData) {
      const userId = args.vendorData as Id<"users">;
      profile = await ctx.db
        .query("instructorProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();
    }

    if (!profile) {
      await ctx.db.patch(eventId, {
        processingError: "instructor_not_found",
        updatedAt: Date.now(),
      });
      return { ignored: false, processed: false, reason: "instructor_not_found" as const };
    }

    await ctx.db.patch(profile._id, {
      diditVerificationStatus: mappedStatus,
      diditStatusRaw: args.statusRaw,
      diditLastEventAt: now,
      diditSessionId: args.sessionId ?? profile.diditSessionId,
      ...omitUndefined({
        diditDecision: args.decision,
      }),
      ...(mappedStatus === "approved" ? { diditVerifiedAt: now } : {}),
      updatedAt: now,
    });

    if (mappedStatus === "approved") {
      const legalName = extractLegalName(args.decision);
      if (legalName.fullName) {
        await ctx.db.patch("users", profile.userId, {
          fullName: legalName.fullName,
          name: legalName.fullName,
          updatedAt: now,
        });
        await ctx.db.patch(profile._id, {
          displayName: legalName.fullName,
          ...omitUndefined({
            diditLegalFirstName: legalName.firstName,
            diditLegalLastName: legalName.lastName,
            diditLegalName: legalName.fullName,
          }),
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(eventId, {
      processed: true,
      instructorId: profile._id,
      updatedAt: Date.now(),
    });

    return { ignored: false, processed: true };
  },
});
