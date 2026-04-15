import {
  cellToBoundary,
  cellToParent,
  compactCells,
  getHexagonEdgeLengthAvg,
  getResolution,
  gridDisk,
  latLngToCell,
} from "h3-js";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const H3_RESOLUTION = 9;
export const H3_JOB_MATCH_MIN_RESOLUTION = 4;
const H3_MAX_K_RING = 10;

export type H3HierarchySnapshot = {
  h3Index: string;
  h3Res8: string;
  h3Res7: string;
  h3Res4: string;
  h3Res5: string;
  h3Res6: string;
};

export type H3CoverageCell = {
  cell: string;
  resolution: number;
};

export type H3CoveragePolygon = H3CoverageCell & {
  boundary: Array<{
    latitude: number;
    longitude: number;
  }>;
};

/**
 * Convert lat/lng to H3 Res 9 cell string.
 * Returns undefined if coordinates are missing or invalid.
 */
export function safeH3Index(lat: number | undefined, lng: number | undefined): string | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return latLngToCell(lat as number, lng as number, H3_RESOLUTION);
}

export function getH3HierarchyFromCell(cell: string): H3HierarchySnapshot {
  return {
    h3Index: cell,
    h3Res8: cellToParent(cell, 8),
    h3Res7: cellToParent(cell, 7),
    h3Res4: cellToParent(cell, 4),
    h3Res5: cellToParent(cell, 5),
    h3Res6: cellToParent(cell, 6),
  };
}

export function safeH3Hierarchy(
  lat: number | undefined,
  lng: number | undefined,
): H3HierarchySnapshot | undefined {
  const h3Index = safeH3Index(lat, lng);
  if (!h3Index) return undefined;
  return getH3HierarchyFromCell(h3Index);
}

/**
 * Convert a radius in km to the number of H3 k-ring steps at a resolution.
 */
export function radiusToK(radiusKm: number, resolution = H3_RESOLUTION): number {
  const edgeLengthKm = getHexagonEdgeLengthAvg(resolution, "km");
  return Math.ceil(radiusKm / edgeLengthKm);
}

export function getCoverageResolution(radiusKm: number): number {
  for (const resolution of [9, 8, 7, 6, 5] as const) {
    if (radiusToK(radiusKm, resolution) <= H3_MAX_K_RING) {
      return resolution;
    }
  }
  return 5;
}

/**
 * Get all H3 cell strings within a k-ring of the given center coordinates.
 */
export function getWatchZoneCells(
  lat: number,
  lng: number,
  radiusKm: number,
  resolution = getCoverageResolution(radiusKm),
): string[] {
  const centerHex = latLngToCell(lat, lng, resolution);
  const k = radiusToK(radiusKm, resolution);
  return gridDisk(centerHex, k);
}

/**
 * Build a compacted H3 coverage set for an instructor's configured reach.
 */
export function getCompactedCoverageCells(
  lat: number,
  lng: number,
  radiusKm: number,
): H3CoverageCell[] {
  const compacted = compactCells(getWatchZoneCells(lat, lng, radiusKm));
  return compacted.map((cell) => ({
    cell,
    resolution: getResolution(cell),
  }));
}

/**
 * Build the exact H3 cells that should be shown for a radius preview.
 * This intentionally avoids compaction so the UI can render the real cells.
 */
export function getExactCoverageCells(
  lat: number,
  lng: number,
  radiusKm: number,
): H3CoverageCell[] {
  const resolution = getCoverageResolution(radiusKm);
  return getWatchZoneCells(lat, lng, radiusKm, resolution).map((cell) => ({
    cell,
    resolution,
  }));
}

export function getCoveragePolygons(
  lat: number,
  lng: number,
  radiusKm: number,
): H3CoveragePolygon[] {
  return getCompactedCoverageCells(lat, lng, radiusKm).map((coverage) => ({
    ...coverage,
    boundary: cellToBoundary(coverage.cell, true).map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  }));
}

export function getCoveragePreviewPolygons(
  lat: number,
  lng: number,
  radiusKm: number,
): H3CoveragePolygon[] {
  return getExactCoverageCells(lat, lng, radiusKm).map((coverage) => ({
    ...coverage,
    boundary: cellToBoundary(coverage.cell, true).map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  }));
}

/**
 * A job stored at Res 9 can match a compacted instructor cell at any parent
 * resolution we index. Return the exact cell plus its indexed parents.
 */
export function getJobMatchCells(jobH3Index: string): H3CoverageCell[] {
  const cells: H3CoverageCell[] = [{ cell: jobH3Index, resolution: H3_RESOLUTION }];
  for (
    let resolution = H3_RESOLUTION - 1;
    resolution >= H3_JOB_MATCH_MIN_RESOLUTION;
    resolution -= 1
  ) {
    cells.push({
      cell: cellToParent(jobH3Index, resolution),
      resolution,
    });
  }
  return cells;
}

function queryJobsByIndexedCell(
  ctx: QueryCtx,
  args: {
    sport: string;
    cell: string;
    resolution: number;
    status: Doc<"jobs">["status"];
    limit: number;
  },
) {
  switch (args.resolution) {
    case 9:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Index", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    case 8:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_res8_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Res8", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    case 7:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_res7_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Res7", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    case 6:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_res6_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Res6", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    case 5:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_res5_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Res5", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    case 4:
      return ctx.db
        .query("jobs")
        .withIndex("by_sport_h3_res4_status_postedAt", (q) =>
          q.eq("sport", args.sport).eq("h3Res4", args.cell).eq("status", args.status),
        )
        .order("desc")
        .take(args.limit);
    default:
      return Promise.resolve([]);
  }
}

/**
 * Query jobs by precomputed instructor coverage cells.
 * Returns deduplicated jobs sorted by postedAt descending.
 */
export async function queryJobsByCoverage(
  ctx: QueryCtx,
  args: {
    coverageRows: Array<Pick<Doc<"instructorHexCoverage">, "sport" | "cell" | "resolution">>;
    status: Doc<"jobs">["status"];
    limit: number;
  },
): Promise<Doc<"jobs">[]> {
  if (args.coverageRows.length === 0) return [];

  const uniqueRows = [
    ...new Map(
      args.coverageRows.map((row) => [`${row.sport}:${row.resolution}:${row.cell}`, row]),
    ).values(),
  ];
  const limitPerRow = Math.max(Math.ceil(args.limit / uniqueRows.length), 3);

  const rowsByQuery = await Promise.all(
    uniqueRows.map((row) =>
      queryJobsByIndexedCell(ctx, {
        sport: row.sport,
        cell: row.cell,
        resolution: row.resolution,
        status: args.status,
        limit: limitPerRow,
      }),
    ),
  );

  const byId = new Map<string, Doc<"jobs">>();
  for (const jobs of rowsByQuery) {
    for (const job of jobs) {
      byId.set(String(job._id), job);
    }
  }

  return [...byId.values()].sort((a, b) => b.postedAt - a.postedAt).slice(0, args.limit);
}
