import type { IStoreGameRow } from "./discovery";

export interface QueryApiLike {
  execute(
    queryName: string,
    params?: Record<string, unknown>,
  ): Promise<IStoreGameRow[]>;
  onDirty(callback: (queryNames: string[]) => void): () => void;
}

const STORE_GAMES_QUERY = "all_store_games";

export function loadStoreGames(queryApi: QueryApiLike): Promise<IStoreGameRow[]> {
  return queryApi.execute(STORE_GAMES_QUERY, {});
}

export function subscribeToStoreGamesDirty(
  queryApi: QueryApiLike,
  callback: () => void,
): () => void {
  return queryApi.onDirty((queryNames) => {
    if (queryNames.includes(STORE_GAMES_QUERY)) {
      callback();
    }
  });
}
