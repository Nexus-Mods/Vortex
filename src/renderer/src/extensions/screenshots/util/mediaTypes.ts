import type { VDFObject } from "simple-vdf";

import type { ITString } from "@/util/i18n";

export interface GameMediaSource {
  name: string | ITString;
  path: string | (() => Promise<string>);
  custom?: boolean;
  filterFn?: (s: string) => boolean;
  discoverFn?: (mediaPath: string) => Promise<GameMediaItem[]>;
  description?: string | ITString;
}

export type ResolvedGameMediaSource = Omit<GameMediaSource, "path"> & { path: string };

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

export interface SteamScreenshotsVDF extends VDFObject {
  screenshots: Record<string, Record<string, SteamScreenshot>>;
}

export interface SteamScreenshot extends VDFObject {
  type: string;
  filename: string;
  thumbnail: string;
}

export interface SteamLoginUsersVDF extends VDFObject {
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
