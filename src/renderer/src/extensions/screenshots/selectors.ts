import type { IState } from "@/types/IState";

import type { IGameMediaPersistentState } from "./reducers/persistent";
import type { IGameMediaSessionState } from "./reducers/session";
import type { GameMediaItem, GameMediaModTag } from "./util/mediaTypes";

const NO_DISABLED: readonly string[] = [];
const NO_TAGS: readonly GameMediaModTag[] = [];
const NO_MEDIA_STATE = { sources: {}, modTags: {}, disabledSources: {}, flags: {} } as const;
const NO_MEDIA_SESSION = { items: [] } as const;

const mediaState = (state: IState): IGameMediaPersistentState =>
  (state.persistent as never)["game_media"] ?? NO_MEDIA_STATE;

const mediaSessionState = (state: IState): IGameMediaSessionState =>
  (state.session as never)["game_media"] ?? NO_MEDIA_SESSION;

export const customSources = (state: IState, gameId: string) => mediaState(state).sources[gameId];
export const disabledSources = (state: IState, gameId: string) =>
  mediaState(state).disabledSources[gameId] ?? NO_DISABLED;
export const modTags = (state: IState, gameId: string, mediaId: string) =>
  mediaState(state).modTags[gameId]?.[mediaId] ?? NO_TAGS;
export const gameMediaFlags = (state: IState) => mediaState(state).flags;
export const sessionItems = (state: IState) => mediaSessionState(state).items;
export const orphanedTagIds = (
  state: IState,
  gameId: string,
  liveItems: readonly GameMediaItem[],
) => {
  if (!liveItems) return [];
  const live = new Set(liveItems.map((i) => i.id));
  return Object.keys(mediaState(state).modTags[gameId] ?? {}).filter((id) => !live.has(id));
};
