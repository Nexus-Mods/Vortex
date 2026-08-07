export interface MediaSource {
  name: string;
  path: string;
  active: boolean;
  filterFn?: (s: string) => boolean;
  description?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  sourceId: string;
  type: "image" | "video";
  thumbnailPath?: string;
}

export interface SteamScreenshotsVDF {
  screenshots: Record<
    number,
    Record<number, { type: number; filename: string; thumbnail: string }>
  >;
}
