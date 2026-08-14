export interface GameMediaSource {
  name: string;
  path: string;
  active: boolean;
  filterFn?: (s: string) => boolean;
  discoverFn?: (mediaPath: string) => Promise<GameMediaItem[]>;
  description?: string;
}

export interface GameMediaItem {
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

export interface GameMediaModTag {
  id: string;
  name: string;
  url?: string;
  thumbnail?: string;
  comment?: string;
  x: number;
  y: number;
  createdAt: string;
}
