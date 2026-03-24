import { types } from "vortex-api";

/**
 * Maps a range of game runtime versions to the required script extender version.
 * Used for games like Skyrim SE/AE where different game versions need different
 * script extender builds.
 */
export interface IGameVersionMapping {
  /** Semver range for game runtime versions (e.g., ">=1.5.0 <1.6.0") */
  gameVersionRange: string;
  /** Human-readable label for this version range (e.g., "SE (1.5.97)", "AE (1.6.640+)") */
  label: string;
  /** The recommended/required script extender version for this game version range */
  scriptExtenderVersion: string;
}

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
  /**
   * Optional version mappings for games where different runtime versions
   * require different script extender builds. When present, the correct
   * script extender version should be resolved based on the installed game version.
   */
  versionMap?: IGameVersionMapping[];
}
