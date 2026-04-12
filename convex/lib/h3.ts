import { latLngToCell, gridDisk } from "h3-js";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const H3_RESOLUTION = 7;
export const H3_RES7_EDGE_KM = 1.22;

/**
 * Convert lat/lng to H3 Res 7 cell string.
 * Returns undefined if coordinates are missing or invalid.
 */
export function safeH3Index(
  lat: number | undefined,
  lng: number | undefined,
): string | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Convert a radius in km to the number of H3 k-ring steps at Res 7.
 */
export function radiusToK(radiusKm: number): number {
  return Math.ceil(radiusKm / H3_RES7_EDGE_KM);
}

/**
 * Get all H3 cell strings within a k-ring of the given center coordinates.
 */
export function getWatchZoneCells(
  lat: number,
  lng: number,
  radiusKm: number,
): string[] {
  const centerHex = latLngToCell(lat, lng, H3_RESOLUTION);
  const k = radiusToK(radiusKm);
  return gridDisk(centerHex, k);
}

/**
 * Query jobs by H3 cells for a set of sports.
 * Returns deduplicated jobs sorted by postedAt descending.
 */
export async function queryJobsByH3Cells(
  ctx: QueryCtx,
  args: {
    hexCells: string[];
    sports: Set<string>;
    status: string;
    limit: number;
  },
): Promise<Doc<"jobs">[]> {
  if (args.hexCells.length === 0 || args.sports.size === 0) return [];

  const sports = [...args.sports];
  const limitPerHex = Math.max(
    Math.ceil(args.limit / args.hexCells.length),
    5,
  );

  const jobsBySport = await Promise.all(
    sports.map((sport) =>
      Promise.all(
        args.hexCells.map((hex) =>
          ctx.db
            .query("jobs")
            .withIndex("by_sport_h3_status_postedAt", (q) =>
              q
                .eq("sport", sport)
                .eq("h3Index", hex)
                .eq("status", args.status),
            )
            .order("desc")
            .take(limitPerHex),
        ),
      ),
    ),
  );

  const byId = new Map<string, Doc<"jobs">>();
  for (const sportJobs of jobsBySport) {
    for (const hexJobs of sportJobs) {
      for (const job of hexJobs) {
        byId.set(String(job._id), job);
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, args.limit);
}
