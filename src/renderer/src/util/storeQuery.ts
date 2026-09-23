export const defaultPriority = 100;

export interface IStoreQuery {
  id?: string;
  name?: string;
  prefer?: number;
}

/** Normalized form of one store's IGame.queryArgs entry. */
export type IQueryArgEntry = string | IStoreQuery | IStoreQuery[];

/**
 * Normalize the polymorphic form `IGame.queryArgs` accepts (string app ID,
 * single query, or array) into a single array of IStoreQuery. Callers that
 * iterate per-store entries should funnel through this so the three forms
 * are handled in one place.
 */
export function normalizeStoreQuery(raw: IQueryArgEntry | undefined): IStoreQuery[] {
  if (raw === undefined) return [];
  if (typeof raw === "string") return [{ id: raw }];
  if (Array.isArray(raw)) return raw;
  return [raw];
}
