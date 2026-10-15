import { createAction } from "redux-act";

import type { IStoreGameVersionCacheEntry } from "@/extensions/analytics/types/telemetry";

/** Written only after a successful send (or a silent volatile-only refresh);
    null removes the entry. */
export const setStoreGameVersionCache = createAction(
  "SET_STORE_GAME_VERSION_CACHE",
  (payload: { gameId: string; cache: IStoreGameVersionCacheEntry | null }) => payload,
);
