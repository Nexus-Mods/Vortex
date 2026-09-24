import type { IMod } from "../../mod_management/types/IMod";
import type { IPluginCombined } from "./IPlugins";

export interface IDataArchive {
  name: string;
  plugin: string;
}

export interface IIncompatibleArchive {
  name: string;
  version: string;
  validVersion: string;
  plugin: IPluginCombined;
  mod: IMod;
}

export interface IGameData {
  gameId: string;
  gameName: string;
  version: number[];
  type: string;
}
