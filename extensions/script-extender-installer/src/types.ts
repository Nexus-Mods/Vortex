import { types } from "vortex-api";

export interface IGameSupport {
  name: string;
  gameId: string;
  gameName: string;
  scriptExtExe: string;
  website: string;
  regex: RegExp;
  attributes: (ver: string) => types.IInstruction[];
  toolId: string; //The ID of the tool as defined by the Vortex extension for the game.
  ignore?: boolean;
  gitHubAPIUrl?: string;
  nexusMods?: {
    gameId: string;
    modId: number;
  };
}
