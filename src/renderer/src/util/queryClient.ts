import type { Serializable } from "@vortex/shared/ipc";
import type { QueryApi } from "@vortex/shared/preload";

type QueryParams = Record<string, Serializable>;

interface QueryEntry {
  data?: unknown;
  error?: QueryError;
  inFlightPromise?: Promise<unknown>;
  queryName: string;
  stale: boolean;
}

interface EnsureQueryOptions {
  force?: boolean;
}

export class QueryError extends Error {
  public readonly queryName: string;

  constructor(message: string, queryName: string) {
    super(message);
    this.name = "QueryError";
    this.queryName = queryName;
  }
}

function toQueryError(err: unknown, queryName: string): QueryError {
  if (err instanceof QueryError) {
    return err;
  }

  if (err instanceof Error) {
    const qe = new QueryError(err.message, queryName);
    qe.stack = err.stack;
    return qe;
  }

  if (typeof err === "string") {
    return new QueryError(err, queryName);
  }

  return new QueryError("Query execution failed", queryName);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(obj[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function createQueryKey(queryName: string, params: QueryParams): string {
  return `${queryName}:${stableSerialize(params)}`;
}

export class QueryClient {
  #mEntries: Map<string, QueryEntry> = new Map();
  #mQueryApi: Pick<QueryApi, "execute" | "onDirty">;

  constructor(queryApi: Pick<QueryApi, "execute" | "onDirty">) {
    this.#mQueryApi = queryApi;
    this.#mQueryApi.onDirty((queryNames) => {
      const dirtyQueries = new Set(queryNames);
      for (const entry of this.#mEntries.values()) {
        if (dirtyQueries.has(entry.queryName)) {
          entry.stale = true;
        }
      }
    });
  }

  public ensureQueryData<TResult>(
    queryName: string,
    params: QueryParams = {},
    options: EnsureQueryOptions = {},
  ): Promise<TResult> {
    const entry = this.#getOrCreateEntry(queryName, params);
    if (entry.inFlightPromise !== undefined) {
      return entry.inFlightPromise as Promise<TResult>;
    }

    if (!options.force && !entry.stale && entry.data !== undefined) {
      return Promise.resolve(entry.data as TResult);
    }

    const inFlightPromise = this.#mQueryApi
      .execute(queryName, params)
      .then((result) => {
        entry.data = result;
        entry.error = undefined;
        entry.stale = false;
        return result as TResult;
      })
      .catch((err: unknown) => {
        entry.error = toQueryError(err, queryName);
        entry.stale = true;
        if (entry.data !== undefined) {
          return entry.data as TResult;
        }
        throw entry.error;
      })
      .finally(() => {
        entry.inFlightPromise = undefined;
      });

    entry.inFlightPromise = inFlightPromise as Promise<unknown>;
    return inFlightPromise;
  }

  public peekQueryData<TResult>(
    queryName: string,
    params: QueryParams = {},
  ): TResult | undefined {
    const key = createQueryKey(queryName, params);
    return this.#mEntries.get(key)?.data as TResult | undefined;
  }

  #getOrCreateEntry(queryName: string, params: QueryParams): QueryEntry {
    const key = createQueryKey(queryName, params);
    let entry = this.#mEntries.get(key);

    if (entry === undefined) {
      entry = {
        data: undefined,
        error: undefined,
        inFlightPromise: undefined,
        queryName,
        stale: true,
      };
      this.#mEntries.set(key, entry);
    }

    return entry;
  }
}

let queryClientSingleton: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (queryClientSingleton === undefined) {
    queryClientSingleton = new QueryClient(window.api.query);
  }

  return queryClientSingleton;
}
