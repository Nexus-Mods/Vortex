import type { GameMediaItem } from "./mediaTypes";

export const sortMedia = (a: GameMediaItem, b: GameMediaItem) =>
  (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
