import { createAction } from "redux-act";

import type { GameMediaItem } from "../util/mediaTypes";

export const setFoundGameMedia = createAction("SET_FOUND_GAME_MEDIA", (media: GameMediaItem[]) => ({
  media,
}));
