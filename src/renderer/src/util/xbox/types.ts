import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

export interface IXboxEntry extends IGameStoreEntry {
  packageId: string;
  publisherId: string;
  executionName: string;
  manifestData?: any;
}

export type GamePathMap = { [xboxId: string]: string };
