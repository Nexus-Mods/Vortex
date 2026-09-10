export interface GameMediaSource {
  name: string;
  path: string;
  custom?: boolean;
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

export interface SteamLoginUsersVDF {
  users: Record<
    string,
    {
      AccountName: string;
      PersonaName: string;
      RememberPassword: "1" | "0";
      WantsOfflineMode: "1" | "0";
      SkipOfflineModeWarning: "1" | "0";
      AutoLogin: "1" | "0";
      Timestamp: string;
    }
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
