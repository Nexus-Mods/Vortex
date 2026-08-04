import { createAction } from "redux-act";

import type { MediaItem } from "../util/mediaTypes";

export const setFoundGameMedia = createAction("SET_FOUND_GAME_MEDIA", (media: MediaItem[]) => ({
  media,
}));
