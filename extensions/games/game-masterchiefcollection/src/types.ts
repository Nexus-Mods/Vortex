export interface IHaloGame {
  internalId: string;
  name: string;
  modsPath: string;
  img: string;
}

interface IModIdentifier {
  ModGuid: string;
  HostedModIds?: {
    SteamWorkshopId?: number;
  };
}

interface IVersion {
  Major: number;
  Minor: number;
  Patch: number;
}

interface ITitleDescription {
  Neutral?: string;
}

interface IModContents {
  HasBackgroundVideos?: boolean;
  HasNameplates?: boolean;
}

interface IGameModContents {
  HasSharedFiles?: boolean;
  HasCampaign?: boolean;
  HasSpartanOps?: boolean;
  MultiplayerMaps?: string[];
  FirefightMaps?: string[];
}

export interface IModConfig {
  ModIdentifier?: IModIdentifier;
  ModVersion?: IVersion;
  MinAppVersion?: IVersion;
  MaxAppVersion?: IVersion;
  Engine: string;
  Title?: ITitleDescription;
  Description?: ITitleDescription;
  InheritSharedFiles?: string;
  ModContents?: IModContents;
  GameModContents?: IGameModContents;
}

export type LauncherConfig = Promise<{launcher: string; addInfo?: any; }>;