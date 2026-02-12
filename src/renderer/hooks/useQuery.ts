import { useCallback, useEffect, useRef, useState } from "react";

import type {
  QueryName,
  QueryParamsMap,
  QueryResultMap,
} from "../../shared/types/generated/queryTypes";

export interface UseQueryOptions {
  /** Whether to auto-refresh when invalidation events are received (default: true) */
  autoRefresh?: boolean;
  /** Debounce time in ms for invalidation-triggered refetches (default: 100) */
  debounceMs?: number;
}

export interface UseQueryResult<Q extends QueryName> {
  data: QueryResultMap[Q][] | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * React hook for typed reactive SQL queries.
 *
 * Fetches data on mount via window.api.query.execute, re-fetches when params change,
 * and subscribes to query invalidation events for automatic refresh.
 *
 * @param queryName - The name of the query to execute
 * @param params - Parameters for the query (type-checked against the query definition)
 * @param options - Optional configuration
 */
export function useQuery<Q extends QueryName>(
  queryName: Q,
  params: QueryParamsMap[Q],
  options?: UseQueryOptions,
): UseQueryResult<Q> {
  const { autoRefresh = true, debounceMs = 100 } = options ?? {};

  const [data, setData] = useState<QueryResultMap[Q][] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Use ref for params to enable deep comparison
  const paramsRef = useRef(params);
  const paramsJson = JSON.stringify(params);

  // Update ref when params change (by value)
  useEffect(() => {
    paramsRef.current = params;
  }, [paramsJson]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(undefined);

    window.api.query
      .execute(queryName, paramsRef.current)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [queryName, paramsJson]);

  // Fetch on mount and when queryName/params change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to invalidation events
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = window.api.query.onInvalidated((queryNames) => {
      if (queryNames.includes(queryName as any)) {
        if (debounceTimer !== undefined) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          fetchData();
        }, debounceMs);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    };
  }, [queryName, autoRefresh, debounceMs, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
