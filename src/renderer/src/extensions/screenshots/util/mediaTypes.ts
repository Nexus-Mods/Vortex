export interface MediaSource {
  name: string;
  path: string;
  active: boolean;
  filterFn?: (s: string) => boolean;
  discoverFn?: (mediaPath: string) => Promise<MediaItem[]>;
  description?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  sourceId: string;
  type: "image" | "video";
  thumbnailPath?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  size?: number;
}

export interface SteamScreenshotsVDF {
  screenshots: Record<
    number,
    Record<number, { type: number; filename: string; thumbnail: string }>
  >;
}
