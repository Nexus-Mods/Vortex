import { types } from "vortex-api";

export interface IDataArchive {
  name: string;
  plugin: string;
}

export interface IIncompatibleArchive {
  name: string;
  version: string;
  validVersion: string;
  plugin: any; // IPluginCombined isn't exported and I think I prefer it that way.
  mod: types.IMod;
}

export interface IGameData {
  gameId: string;
  gameName: string;
  version: number[];
  type: string;
}
