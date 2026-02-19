import { v } from "convex/values";

import { ZONE_OPTIONS } from "../constants/zones.generated";
import { internalMutation, query } from "./_generated/server";
import { isKnownZoneId } from "./lib/domainValidation";
import { omitUndefined } from "./lib/validation";

const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 500;

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
    const batchSize = Math.min(
      Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1),
      MAX_BATCH_SIZE,
    );
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
    const batchSize = Math.min(
      Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1),
      MAX_BATCH_SIZE,
    );

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
        const resolved =
          resolveZoneId(job.zone) ??
          studioResolvedZone;
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
