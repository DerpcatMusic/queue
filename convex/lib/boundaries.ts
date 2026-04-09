import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;

export type InstructorBoundarySubscriptionPair = {
  provider: string;
  boundaryId: string;
};

export const DEFAULT_BOUNDARY_PROVIDER = "israel-pikud";
export const MAX_INSTRUCTOR_BOUNDARIES = 25;

export function buildLegacyZoneBoundary(zone: string, provider?: string) {
  return {
    boundaryProvider: normalizeBoundaryProvider(provider),
    boundaryId: normalizeBoundaryId(zone),
  };
}

export function resolveBoundaryAssignment(args: {
  provider?: string;
  boundaryId?: string;
  legacyZone?: string;
}) {
  const sourceBoundaryId = args.boundaryId?.trim() || args.legacyZone?.trim();
  if (!sourceBoundaryId) {
    throw new ConvexError("Boundary assignment requires a boundary ID or legacy zone");
  }
  return {
    boundaryProvider: normalizeBoundaryProvider(args.provider),
    boundaryId: normalizeBoundaryId(sourceBoundaryId),
  };
}

export function normalizeBoundaryId(boundaryId: string) {
  const normalized = boundaryId.trim();
  if (!normalized) {
    throw new ConvexError("Boundary ID is required");
  }
  if (normalized.length > 160) {
    throw new ConvexError("Boundary ID is too long");
  }
  return normalized;
}

export function normalizeBoundaryProvider(provider: string | undefined) {
  const normalized = provider?.trim() || DEFAULT_BOUNDARY_PROVIDER;
  if (!normalized) {
    throw new ConvexError("Boundary provider is required");
  }
  if (normalized.length > 80) {
    throw new ConvexError("Boundary provider is too long");
  }
  return normalized;
}

export async function replaceInstructorBoundarySubscriptions(
  ctx: MutationCtx,
  args: {
    instructorId: Id<"instructorProfiles">;
    boundaryIds: string[];
    provider?: string;
  },
) {
  const provider = normalizeBoundaryProvider(args.provider);
  const boundaryIds = [
    ...new Set(args.boundaryIds.map((boundaryId) => normalizeBoundaryId(boundaryId))),
  ];

  if (boundaryIds.length > MAX_INSTRUCTOR_BOUNDARIES) {
    throw new ConvexError("Too many boundaries selected");
  }

  const existing = await ctx.db
    .query("instructorBoundarySubscriptions")
    .withIndex("by_instructor_provider", (q) =>
      q.eq("instructorId", args.instructorId).eq("provider", provider),
    )
    .collect();

  await Promise.all(
    existing.map((row) => ctx.db.delete("instructorBoundarySubscriptions", row._id)),
  );

  const now = Date.now();
  await Promise.all(
    boundaryIds.map((boundaryId) =>
      ctx.db.insert("instructorBoundarySubscriptions", {
        instructorId: args.instructorId,
        provider,
        boundaryId,
        createdAt: now,
      }),
    ),
  );

  return {
    provider,
    boundaryIds,
  };
}

export async function listInstructorBoundarySubscriptions(
  ctx: Ctx,
  args: {
    instructorId: Id<"instructorProfiles">;
    provider?: string;
  },
) {
  const provider = normalizeBoundaryProvider(args.provider);
  const rows = await ctx.db
    .query("instructorBoundarySubscriptions")
    .withIndex("by_instructor_provider", (q) =>
      q.eq("instructorId", args.instructorId).eq("provider", provider),
    )
    .collect();

  return rows.map((row) => row.boundaryId).sort();
}

export async function listInstructorBoundarySubscriptionPairs(
  ctx: Ctx,
  args: {
    instructorId: Id<"instructorProfiles">;
  },
): Promise<InstructorBoundarySubscriptionPair[]> {
  const rows = await ctx.db
    .query("instructorBoundarySubscriptions")
    .withIndex("by_instructor_provider", (q) => q.eq("instructorId", args.instructorId))
    .collect();

  return rows.map((row) => ({
    provider: row.provider,
    boundaryId: row.boundaryId,
  }));
}

export async function hasInstructorBoundarySubscription(
  ctx: Ctx,
  args: {
    instructorId: Id<"instructorProfiles">;
    provider: string;
    boundaryId: string;
  },
) {
  const provider = normalizeBoundaryProvider(args.provider);
  const boundaryId = normalizeBoundaryId(args.boundaryId);
  const row = await ctx.db
    .query("instructorBoundarySubscriptions")
    .withIndex("by_provider_boundary_instructor", (q) =>
      q.eq("provider", provider).eq("boundaryId", boundaryId).eq("instructorId", args.instructorId),
    )
    .unique();

  return Boolean(row);
}
