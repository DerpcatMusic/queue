import { v } from "convex/values";

import { ZONE_OPTIONS } from "../src/constants/zones.generated";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { isKnownZoneId } from "./lib/domainValidation";
import { omitUndefined } from "./lib/validation";

const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 500;

type DiditBackfillBatchPageItem = {
  instructorId: Id<"instructorProfiles">;
  diditSessionId?: string;
  diditVerificationStatus?:
    | "not_started"
    | "in_progress"
    | "pending"
    | "in_review"
    | "approved"
    | "declined"
    | "abandoned"
    | "expired";
  diditStatusRaw?: string;
  diditDecision?: any;
};

type DiditBackfillBatchResult = {
  page: DiditBackfillBatchPageItem[];
  isDone: boolean;
  continueCursor: string;
};

function toCleanZone(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const LEGACY_ZONE_TO_ID = new Map<string, string>(
  ZONE_OPTIONS.flatMap((zone) => [
    [zone.id.toLowerCase(), zone.id] as const,
    [zone.label.en.trim().toLowerCase(), zone.id] as const,
    [zone.label.he.trim().toLowerCase(), zone.id] as const,
  ]),
);

function resolveZoneId(value: string | undefined): string | undefined {
  const cleaned = toCleanZone(value);
  if (!cleaned) return undefined;
  if (isKnownZoneId(cleaned)) return cleaned;
  return LEGACY_ZONE_TO_ID.get(cleaned.toLowerCase());
}

export const getZoneDataQualityReport = query({
  args: {
    sampleLimit: v.optional(v.number()),
  },
  returns: v.object({
    studiosTotal: v.number(),
    jobsTotal: v.number(),
    invalidStudiosCount: v.number(),
    invalidJobsCount: v.number(),
    invalidOpenJobsCount: v.number(),
    invalidStudioSamples: v.array(
      v.object({
        studioId: v.id("studioProfiles"),
        zone: v.string(),
      }),
    ),
    invalidJobSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
        studioId: v.id("studioProfiles"),
        zone: v.string(),
        status: v.union(
          v.literal("open"),
          v.literal("filled"),
          v.literal("cancelled"),
          v.literal("completed"),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const sampleLimit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 100);

    const [studios, jobs] = await Promise.all([
      ctx.db.query("studioProfiles").collect(),
      ctx.db.query("jobs").collect(),
    ]);

    const invalidStudios = studios.filter((studio) => {
      const zone = toCleanZone(studio.zone);
      return !zone || !isKnownZoneId(zone);
    });
    const invalidJobs = jobs.filter((job) => {
      const zone = toCleanZone(job.zone);
      return !zone || !isKnownZoneId(zone);
    });

    return {
      studiosTotal: studios.length,
      jobsTotal: jobs.length,
      invalidStudiosCount: invalidStudios.length,
      invalidJobsCount: invalidJobs.length,
      invalidOpenJobsCount: invalidJobs.filter((job) => job.status === "open").length,
      invalidStudioSamples: invalidStudios.slice(0, sampleLimit).map((studio) => ({
        studioId: studio._id,
        zone: studio.zone,
      })),
      invalidJobSamples: invalidJobs.slice(0, sampleLimit).map((job) => ({
        jobId: job._id,
        studioId: job.studioId,
        zone: job.zone,
        status: job.status,
      })),
    };
  },
});

export const backfillJobZonesFromStudioProfiles = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skippedInvalidStudioZone: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patched = 0;
    let skippedInvalidStudioZone = 0;
    for (const job of page.page) {
      const jobZone = toCleanZone(job.zone);
      if (jobZone && isKnownZoneId(jobZone)) {
        continue;
      }

      const studio = await ctx.db.get(job.studioId);
      const studioZone = toCleanZone(studio?.zone);
      if (!studioZone || !isKnownZoneId(studioZone)) {
        skippedInvalidStudioZone += 1;
        continue;
      }

      await ctx.db.patch("jobs", job._id, { zone: studioZone });
      patched += 1;
    }

    return {
      scanned: page.page.length,
      patched,
      skippedInvalidStudioZone,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const normalizeLegacyZoneStrings = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scannedStudios: v.number(),
    patchedStudios: v.number(),
    unresolvedStudios: v.number(),
    scannedJobs: v.number(),
    patchedJobs: v.number(),
    unresolvedJobs: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    const studioPage = await ctx.db
      .query("studioProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patchedStudios = 0;
    let unresolvedStudios = 0;
    const patchedStudioZoneById = new Map<string, string>();

    for (const studio of studioPage.page) {
      const resolved = resolveZoneId(studio.zone);
      if (!resolved) {
        unresolvedStudios += 1;
        continue;
      }
      if (resolved !== studio.zone) {
        await ctx.db.patch("studioProfiles", studio._id, { zone: resolved });
        patchedStudios += 1;
      }
      patchedStudioZoneById.set(String(studio._id), resolved);
    }

    const jobs = await Promise.all(
      studioPage.page.map((studio) =>
        ctx.db
          .query("jobs")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect(),
      ),
    );

    let scannedJobs = 0;
    let patchedJobs = 0;
    let unresolvedJobs = 0;
    for (let i = 0; i < studioPage.page.length; i += 1) {
      const studio = studioPage.page[i];
      const studioJobs = jobs[i];
      if (!studio || !studioJobs) {
        continue;
      }
      const studioResolvedZone = patchedStudioZoneById.get(String(studio._id));
      for (const job of studioJobs) {
        scannedJobs += 1;
        const resolved = resolveZoneId(job.zone) ?? studioResolvedZone;
        if (!resolved) {
          unresolvedJobs += 1;
          continue;
        }
        if (resolved !== job.zone) {
          await ctx.db.patch("jobs", job._id, { zone: resolved });
          patchedJobs += 1;
        }
      }
    }

    return {
      scannedStudios: studioPage.page.length,
      patchedStudios,
      unresolvedStudios,
      scannedJobs,
      patchedJobs,
      unresolvedJobs,
      hasMore: !studioPage.isDone,
      ...omitUndefined({
        continueCursor: studioPage.isDone ? undefined : studioPage.continueCursor,
      }),
    };
  },
});

export const backfillJobApplicationStats = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scannedJobs: v.number(),
    upsertedStats: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    const page = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let upsertedStats = 0;
    for (const job of page.page) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      const applicationsCount = applications.length;
      const pendingApplicationsCount = applications.filter(
        (application) => application.status === "pending",
      ).length;
      const existing = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .unique();
      const next = {
        studioId: job.studioId,
        applicationsCount,
        pendingApplicationsCount,
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, next);
      } else {
        await ctx.db.insert("jobApplicationStats", {
          jobId: job._id,
          ...next,
        });
      }
      upsertedStats += 1;
    }

    return {
      scannedJobs: page.page.length,
      upsertedStats,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const backfillJobApplicationStudioIds = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skippedMissingJob: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("jobApplications")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patched = 0;
    let skippedMissingJob = 0;

    for (const application of page.page) {
      const job = await ctx.db.get(application.jobId);
      if (!job) {
        skippedMissingJob += 1;
        continue;
      }
      if (application.studioId === job.studioId) {
        continue;
      }
      await ctx.db.patch("jobApplications", application._id, {
        studioId: job.studioId,
      });
      patched += 1;
    }

    return {
      scanned: page.page.length,
      patched,
      skippedMissingJob,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const getJobApplicationStatsConsistencyReport = query({
  args: {
    sampleLimit: v.optional(v.number()),
  },
  returns: v.object({
    jobsTotal: v.number(),
    statsTotal: v.number(),
    missingStatsCount: v.number(),
    mismatchedStatsCount: v.number(),
    studioIdMismatchCount: v.number(),
    missingStatsSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
      }),
    ),
    mismatchedStatsSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
        expectedApplicationsCount: v.number(),
        actualApplicationsCount: v.number(),
        expectedPendingApplicationsCount: v.number(),
        actualPendingApplicationsCount: v.number(),
      }),
    ),
    studioIdMismatchSamples: v.array(
      v.object({
        applicationId: v.id("jobApplications"),
        jobId: v.id("jobs"),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const sampleLimit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 200);
    const [jobs, stats, applications] = await Promise.all([
      ctx.db.query("jobs").collect(),
      ctx.db.query("jobApplicationStats").collect(),
      ctx.db.query("jobApplications").collect(),
    ]);

    const jobById = new Map(jobs.map((job) => [String(job._id), job] as const));
    const statByJobId = new Map(stats.map((stat) => [String(stat.jobId), stat] as const));

    const applicationsByJobId = new Map<string, Doc<"jobApplications">[]>();
    for (const application of applications) {
      const jobId = String(application.jobId);
      const existing = applicationsByJobId.get(jobId);
      if (existing) {
        existing.push(application);
      } else {
        applicationsByJobId.set(jobId, [application]);
      }
    }

    const missingStatsSamples: Array<{ jobId: Id<"jobs"> }> = [];
    const mismatchedStatsSamples: Array<{
      jobId: Id<"jobs">;
      expectedApplicationsCount: number;
      actualApplicationsCount: number;
      expectedPendingApplicationsCount: number;
      actualPendingApplicationsCount: number;
    }> = [];
    const studioIdMismatchSamples: Array<{
      applicationId: Id<"jobApplications">;
      jobId: Id<"jobs">;
    }> = [];

    let missingStatsCount = 0;
    let mismatchedStatsCount = 0;
    for (const job of jobs) {
      const jobId = String(job._id);
      const stat = statByJobId.get(jobId);
      const jobApplications = applicationsByJobId.get(jobId) ?? [];
      const applicationsCount = jobApplications.length;
      const pendingApplicationsCount = jobApplications.filter(
        (application) => application.status === "pending",
      ).length;

      if (!stat) {
        missingStatsCount += 1;
        if (missingStatsSamples.length < sampleLimit) {
          missingStatsSamples.push({ jobId: job._id });
        }
        continue;
      }

      if (
        stat.applicationsCount !== applicationsCount ||
        stat.pendingApplicationsCount !== pendingApplicationsCount
      ) {
        mismatchedStatsCount += 1;
        if (mismatchedStatsSamples.length < sampleLimit) {
          mismatchedStatsSamples.push({
            jobId: job._id,
            expectedApplicationsCount: applicationsCount,
            actualApplicationsCount: stat.applicationsCount,
            expectedPendingApplicationsCount: pendingApplicationsCount,
            actualPendingApplicationsCount: stat.pendingApplicationsCount,
          });
        }
      }
    }

    let studioIdMismatchCount = 0;
    for (const application of applications) {
      const job = jobById.get(String(application.jobId));
      if (!job) continue;
      if (application.studioId === job.studioId) continue;
      studioIdMismatchCount += 1;
      if (studioIdMismatchSamples.length < sampleLimit) {
        studioIdMismatchSamples.push({
          applicationId: application._id,
          jobId: application.jobId,
        });
      }
    }

    return {
      jobsTotal: jobs.length,
      statsTotal: stats.length,
      missingStatsCount,
      mismatchedStatsCount,
      studioIdMismatchCount,
      missingStatsSamples,
      mismatchedStatsSamples,
      studioIdMismatchSamples,
    };
  },
});

export const repairJobApplicationStatsForJobs = internalMutation({
  args: {
    jobIds: v.array(v.id("jobs")),
  },
  returns: v.object({
    repaired: v.number(),
    missingJobs: v.number(),
  }),
  handler: async (ctx, args) => {
    let repaired = 0;
    let missingJobs = 0;

    for (const jobId of args.jobIds) {
      const job = await ctx.db.get(jobId);
      if (!job) {
        missingJobs += 1;
        continue;
      }
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const applicationsCount = applications.length;
      const pendingApplicationsCount = applications.filter(
        (application) => application.status === "pending",
      ).length;
      const existing = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .unique();
      const next = {
        studioId: job.studioId,
        applicationsCount,
        pendingApplicationsCount,
        updatedAt: Date.now(),
      };
      if (existing) {
        await ctx.db.patch(existing._id, next);
      } else {
        await ctx.db.insert("jobApplicationStats", {
          jobId: job._id,
          ...next,
        });
      }
      repaired += 1;
    }

    return { repaired, missingJobs };
  },
});

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
  handler: async (
    ctx,
    args,
  ): Promise<{
    scanned: number;
    synced: number;
    skippedNoSession: number;
    skippedAlreadyApproved: number;
    failed: number;
    hasMore: boolean;
    continueCursor?: string;
  }> => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 50, 1), 100);
    const onlyNonApproved = args.onlyNonApproved ?? true;
    const diditApiKey = (process.env.DIDIT_API_KEY ?? "").trim();
    if (!diditApiKey) {
      throw new Error("Missing DIDIT_API_KEY");
    }
    const diditBaseUrl = (process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL).trim();
    const page: DiditBackfillBatchResult = await ctx.runQuery(
      internal.migrations.getDiditBackfillInstructorBatch,
      {
        batchSize,
        ...omitUndefined({
          cursor: args.cursor,
        }),
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

        await ctx.runMutation(internal.didit.applyDiditVerificationSnapshot, {
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
        diditVerificationStatus: v.optional(
          v.union(
            v.literal("not_started"),
            v.literal("in_progress"),
            v.literal("pending"),
            v.literal("in_review"),
            v.literal("approved"),
            v.literal("declined"),
            v.literal("abandoned"),
            v.literal("expired"),
          ),
        ),
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
