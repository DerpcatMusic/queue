import { ConvexError, v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import {
  listInstructorBoundarySubscriptions,
  MAX_INSTRUCTOR_BOUNDARIES,
  normalizeBoundaryId,
  normalizeBoundaryProvider,
  replaceInstructorBoundarySubscriptions,
} from "./lib/boundaries";
import { omitUndefined } from "./lib/validation";

const boundaryCatalogEntryValidator = v.object({
  provider: v.string(),
  boundaryId: v.string(),
  kind: v.string(),
  countryCode: v.string(),
  name: v.string(),
  parentBoundaryId: v.optional(v.string()),
  cityKey: v.optional(v.string()),
  postcode: v.optional(v.string()),
  centroidLatitude: v.optional(v.number()),
  centroidLongitude: v.optional(v.number()),
  bbox: v.optional(
    v.object({
      swLng: v.number(),
      swLat: v.number(),
      neLng: v.number(),
      neLat: v.number(),
    }),
  ),
  metadata: v.optional(v.any()),
});

async function upsertBoundaryCatalogEntryInternal(
  ctx: MutationCtx,
  args: {
    provider: string;
    boundaryId: string;
    kind: string;
    countryCode: string;
    name: string;
    parentBoundaryId?: string;
    cityKey?: string;
    postcode?: string;
    centroidLatitude?: number;
    centroidLongitude?: number;
    bbox?: { swLng: number; swLat: number; neLng: number; neLat: number };
    metadata?: unknown;
  },
) {
  const provider = normalizeBoundaryProvider(args.provider);
  const boundaryId = normalizeBoundaryId(args.boundaryId);
  const now = Date.now();
  const existing = await ctx.db
    .query("boundaries")
    .withIndex("by_provider_boundary", (q) =>
      q.eq("provider", provider).eq("boundaryId", boundaryId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      kind: args.kind,
      countryCode: args.countryCode,
      name: args.name,
      parentBoundaryId: args.parentBoundaryId,
      cityKey: args.cityKey,
      postcode: args.postcode,
      centroidLatitude: args.centroidLatitude,
      centroidLongitude: args.centroidLongitude,
      bbox: args.bbox,
      metadata: args.metadata,
      updatedAt: now,
    });
    return { boundaryDocId: existing._id, created: false };
  }

  const boundaryDocId = await ctx.db.insert("boundaries", {
    provider,
    boundaryId,
    kind: args.kind,
    countryCode: args.countryCode,
    name: args.name,
    createdAt: now,
    updatedAt: now,
    ...omitUndefined({
      parentBoundaryId: args.parentBoundaryId,
      cityKey: args.cityKey,
      postcode: args.postcode,
      centroidLatitude: args.centroidLatitude,
      centroidLongitude: args.centroidLongitude,
      bbox: args.bbox,
      metadata: args.metadata,
    }),
  });
  return { boundaryDocId, created: true };
}

async function requireInstructorProfileId(ctx: Parameters<typeof requireCurrentUser>[0]) {
  const user = await requireCurrentUser(ctx);
  if (user.role !== "instructor") {
    throw new ConvexError("Only instructor users can manage boundaries");
  }

  const profile = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();

  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }

  return profile._id;
}

export const getMyInstructorBoundaries = query({
  args: {
    provider: v.optional(v.string()),
  },
  returns: v.object({
    provider: v.string(),
    boundaryIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const instructorId = await requireInstructorProfileId(ctx);
    const provider = normalizeBoundaryProvider(args.provider);
    const boundaryIds = await listInstructorBoundarySubscriptions(ctx, {
      instructorId,
      provider,
    });
    return { provider, boundaryIds };
  },
});

export const setMyInstructorBoundaries = mutation({
  args: {
    provider: v.optional(v.string()),
    boundaryIds: v.array(v.string()),
  },
  returns: v.object({
    provider: v.string(),
    boundaryCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const instructorId = await requireInstructorProfileId(ctx);
    const provider = normalizeBoundaryProvider(args.provider);
    const boundaryIds = [
      ...new Set(args.boundaryIds.map((boundaryId) => normalizeBoundaryId(boundaryId))),
    ];
    if (boundaryIds.length > MAX_INSTRUCTOR_BOUNDARIES) {
      throw new ConvexError("Too many boundaries selected");
    }
    const result = await replaceInstructorBoundarySubscriptions(ctx, {
      instructorId,
      provider,
      boundaryIds,
    });
    return {
      provider: result.provider,
      boundaryCount: result.boundaryIds.length,
    };
  },
});

export const upsertBoundaryCatalogEntry = mutation({
  args: boundaryCatalogEntryValidator,
  returns: v.object({
    boundaryDocId: v.id("boundaries"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => await upsertBoundaryCatalogEntryInternal(ctx, args),
});

export const upsertBoundaryCatalogBatch = mutation({
  args: {
    entries: v.array(boundaryCatalogEntryValidator),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.entries.length === 0) {
      return { processed: 0, created: 0, updated: 0 };
    }
    if (args.entries.length > 500) {
      throw new ConvexError("Batch too large");
    }

    let created = 0;
    let updated = 0;
    for (const entry of args.entries) {
      const result = await upsertBoundaryCatalogEntryInternal(ctx, entry);
      if (result.created) created += 1;
      else updated += 1;
    }
    return {
      processed: args.entries.length,
      created,
      updated,
    };
  },
});

export const getBoundaryCatalogEntry = query({
  args: {
    provider: v.string(),
    boundaryId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      provider: v.string(),
      boundaryId: v.string(),
      kind: v.string(),
      countryCode: v.string(),
      name: v.string(),
      parentBoundaryId: v.optional(v.string()),
      cityKey: v.optional(v.string()),
      postcode: v.optional(v.string()),
      centroidLatitude: v.optional(v.number()),
      centroidLongitude: v.optional(v.number()),
      bbox: v.optional(
        v.object({
          swLng: v.number(),
          swLat: v.number(),
          neLng: v.number(),
          neLat: v.number(),
        }),
      ),
      metadata: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const provider = normalizeBoundaryProvider(args.provider);
    const boundaryId = normalizeBoundaryId(args.boundaryId);
    const boundary = await ctx.db
      .query("boundaries")
      .withIndex("by_provider_boundary", (q) =>
        q.eq("provider", provider).eq("boundaryId", boundaryId),
      )
      .unique();
    if (!boundary) return null;
    return {
      provider: boundary.provider,
      boundaryId: boundary.boundaryId,
      kind: boundary.kind,
      countryCode: boundary.countryCode,
      name: boundary.name,
      ...omitUndefined({
        parentBoundaryId: boundary.parentBoundaryId,
        cityKey: boundary.cityKey,
        postcode: boundary.postcode,
        centroidLatitude: boundary.centroidLatitude,
        centroidLongitude: boundary.centroidLongitude,
        bbox: boundary.bbox,
        metadata: boundary.metadata,
      }),
    };
  },
});

export const listBoundaryCatalogEntries = query({
  args: {
    provider: v.string(),
    countryCode: v.string(),
    kind: v.string(),
    parentBoundaryId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      provider: v.string(),
      boundaryId: v.string(),
      kind: v.string(),
      countryCode: v.string(),
      name: v.string(),
      parentBoundaryId: v.optional(v.string()),
      cityKey: v.optional(v.string()),
      postcode: v.optional(v.string()),
      centroidLatitude: v.optional(v.number()),
      centroidLongitude: v.optional(v.number()),
      bbox: v.optional(
        v.object({
          swLng: v.number(),
          swLat: v.number(),
          neLng: v.number(),
          neLat: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const provider = normalizeBoundaryProvider(args.provider);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const rows = await ctx.db
      .query("boundaries")
      .withIndex("by_provider_country_kind", (q) =>
        q.eq("provider", provider).eq("countryCode", args.countryCode).eq("kind", args.kind),
      )
      .take(limit * 3);

    return rows
      .filter((row) =>
        args.parentBoundaryId === undefined ? true : row.parentBoundaryId === args.parentBoundaryId,
      )
      .slice(0, limit)
      .map((row) => ({
        provider: row.provider,
        boundaryId: row.boundaryId,
        kind: row.kind,
        countryCode: row.countryCode,
        name: row.name,
        ...omitUndefined({
          parentBoundaryId: row.parentBoundaryId,
          cityKey: row.cityKey,
          postcode: row.postcode,
          centroidLatitude: row.centroidLatitude,
          centroidLongitude: row.centroidLongitude,
          bbox: row.bbox,
        }),
      }));
  },
});

export const searchBoundaryCatalog = query({
  args: {
    provider: v.string(),
    countryCode: v.optional(v.string()),
    kind: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      provider: v.string(),
      boundaryId: v.string(),
      kind: v.string(),
      countryCode: v.string(),
      name: v.string(),
      parentBoundaryId: v.optional(v.string()),
      cityKey: v.optional(v.string()),
      postcode: v.optional(v.string()),
      centroidLatitude: v.optional(v.number()),
      centroidLongitude: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const provider = normalizeBoundaryProvider(args.provider);
    const needle = args.query.trim().toLowerCase();
    if (!needle) return [];
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const rows = args.countryCode && args.kind
      ? await ctx.db
          .query("boundaries")
          .withIndex("by_provider_country_kind", (q) =>
            q.eq("provider", provider).eq("countryCode", args.countryCode!).eq("kind", args.kind!),
          )
          .take(1000)
      : await ctx.db.query("boundaries").collect();

    return rows
      .filter((row) => {
        if (row.provider !== provider) return false;
        if (args.countryCode && row.countryCode !== args.countryCode) return false;
        if (args.kind && row.kind !== args.kind) return false;
        const haystacks = [row.name, row.postcode, row.cityKey, row.boundaryId]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return haystacks.some((value) => value.includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row) => ({
        provider: row.provider,
        boundaryId: row.boundaryId,
        kind: row.kind,
        countryCode: row.countryCode,
        name: row.name,
        ...omitUndefined({
          parentBoundaryId: row.parentBoundaryId,
          cityKey: row.cityKey,
          postcode: row.postcode,
          centroidLatitude: row.centroidLatitude,
          centroidLongitude: row.centroidLongitude,
        }),
      }));
  },
});
