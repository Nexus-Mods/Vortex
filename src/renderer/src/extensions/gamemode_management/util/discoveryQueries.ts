import type { IStoreGameRow } from "./discovery";

import { getQueryClient } from "../../../util/queryClient";

export interface QueryClientLike {
  ensureQueryData<TResult>(
    queryName: string,
    params?: Record<string, unknown>,
    options?: { force?: boolean },
  ): Promise<TResult>;
}

const STORE_GAMES_QUERY = "all_store_games";

export function loadStoreGames(
  queryClient: QueryClientLike = getQueryClient(),
): Promise<IStoreGameRow[]> {
  return queryClient.ensureQueryData<IStoreGameRow[]>(STORE_GAMES_QUERY, {}, {
    force: true,
  });
}
