import type { IGame } from "../../../types/IGame";
import type { IModType } from "../../gamemode_management/types/IModType";
import type { IMod } from "../types/IMod";

const MERGE_SUBDIR = "zzz_merge";

export function genSubDirFunc(game: IGame, modType: IModType): (mod: IMod) => string {
  const mergeModsOpt =
    modType !== undefined && modType.options.mergeMods !== undefined
      ? modType.options.mergeMods
      : (game.mergeMods ?? true);

  if (typeof mergeModsOpt === "boolean") {
    return mergeModsOpt ? () => "" : (mod: IMod) => (mod !== null ? mod.id : MERGE_SUBDIR);
  } else {
    return (mod: IMod) => {
      try {
        return mergeModsOpt(mod);
      } catch (err) {
        // if the game doesn't implement generating a output path for the merge,
        // use the default
        if (mod === null) {
          return MERGE_SUBDIR;
        } else {
          throw err;
        }
      }
    };
  }
}
