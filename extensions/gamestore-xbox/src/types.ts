import { types } from 'vortex-api';

export interface IXboxEntry extends types.IGameStoreEntry {
  packageId: string;
  publisherId: string;
  executionName: string;
  manifestData?: any;
}

export type GamePathMap = { [xboxId: string]: string };