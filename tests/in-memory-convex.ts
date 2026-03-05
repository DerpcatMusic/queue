import type { Id } from "../convex/_generated/dataModel";

type AnyDoc = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

type EqCondition = {
  field: string;
  value: unknown;
};

class InMemoryQuery {
  private readonly table: AnyDoc[];
  private readonly conditions: EqCondition[] = [];
  private sortDirection: "asc" | "desc" | null = null;

  constructor(table: AnyDoc[]) {
    this.table = table;
  }

  withIndex(
    _indexName: string,
    builder: (q: { eq(field: string, value: unknown): unknown }) => unknown,
  ) {
    const queryBuilder = {
      eq: (field: string, value: unknown) => {
        this.conditions.push({ field, value });
        return queryBuilder;
      },
    };
    builder(queryBuilder);
    return this;
  }

  order(direction: "asc" | "desc") {
    this.sortDirection = direction;
    return this;
  }

  async take(limit: number) {
    return this.resolve().slice(0, limit);
  }

  async collect() {
    return this.resolve();
  }

  async unique() {
    const rows = this.resolve();
    return rows[0] ?? null;
  }

  private resolve() {
    let rows = this.table.filter((row) =>
      this.conditions.every((condition) => row[condition.field] === condition.value),
    );
    if (this.sortDirection) {
      rows = [...rows].sort((a, b) => {
        const left = Number(a._creationTime);
        const right = Number(b._creationTime);
        return this.sortDirection === "asc" ? left - right : right - left;
      });
    }
    return rows;
  }
}

export class InMemoryConvexDb {
  private readonly tables = new Map<string, Map<string, AnyDoc>>();
  private readonly counters = new Map<string, number>();

  query(table: string) {
    return new InMemoryQuery(this.list(table));
  }

  async insert(table: string, value: Record<string, unknown>) {
    const id = this.nextId(table);
    const now = Date.now();
    const row: AnyDoc = {
      ...value,
      _id: id,
      _creationTime: now,
    };
    this.ensureTable(table).set(id, row);
    return id;
  }

  async get(tableOrId: string, maybeId?: string) {
    if (maybeId !== undefined) {
      return this.ensureTable(tableOrId).get(maybeId) ?? null;
    }
    const [table] = tableOrId.split(":");
    if (!table) return null;
    return this.ensureTable(table).get(tableOrId) ?? null;
  }

  async patch(
    tableOrId: string,
    idOrPatch: string | Record<string, unknown>,
    maybePatch?: Record<string, unknown>,
  ) {
    if (typeof idOrPatch === "string") {
      const row = this.ensureTable(tableOrId).get(idOrPatch);
      if (!row) throw new Error(`Missing row: ${tableOrId}:${idOrPatch}`);
      Object.assign(row, maybePatch ?? {});
      return;
    }

    const id = tableOrId;
    const [table] = id.split(":");
    if (!table) throw new Error(`Invalid id: ${id}`);
    const row = this.ensureTable(table).get(id);
    if (!row) throw new Error(`Missing row: ${id}`);
    Object.assign(row, idOrPatch);
  }

  async delete(table: string, id: string) {
    this.ensureTable(table).delete(id);
  }

  list(table: string) {
    return [...this.ensureTable(table).values()];
  }

  private ensureTable(table: string) {
    let existing = this.tables.get(table);
    if (!existing) {
      existing = new Map<string, AnyDoc>();
      this.tables.set(table, existing);
    }
    return existing;
  }

  private nextId(table: string) {
    const next = (this.counters.get(table) ?? 0) + 1;
    this.counters.set(table, next);
    return `${table}:${next}`;
  }
}

export type ScheduledCall = {
  delayMs: number;
  fn: unknown;
  args: unknown;
};

export type RunMutationCall = {
  fn: unknown;
  args: unknown;
};

export function createMutationCtx(args: {
  db: InMemoryConvexDb;
  userId?: Id<"users">;
  schedulerCalls?: ScheduledCall[];
  runMutationCalls?: RunMutationCall[];
  runMutationImpl?: (
    fn: unknown,
    args: unknown,
    ctx: ReturnType<typeof createMutationCtx>,
  ) => Promise<unknown>;
}) {
  const ctx = {
    db: args.db,
    auth: {
      getUserIdentity: async () =>
        args.userId
          ? {
              subject: `${args.userId}|test-session`,
              tokenIdentifier: "test-token",
            }
          : null,
    },
    scheduler: {
      runAfter: async (delayMs: number, fn: unknown, runArgs: unknown) => {
        args.schedulerCalls?.push({
          delayMs,
          fn,
          args: runArgs,
        });
        return undefined;
      },
    },
    runMutation: async (fn: unknown, runArgs: unknown) => {
      args.runMutationCalls?.push({
        fn,
        args: runArgs,
      });
      if (args.runMutationImpl) {
        return await args.runMutationImpl(fn, runArgs, ctx as ReturnType<typeof createMutationCtx>);
      }
      return undefined;
    },
  } as const;
  return ctx;
}
