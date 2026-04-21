import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

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
