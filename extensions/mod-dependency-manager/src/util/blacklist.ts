import minimatch = require("minimatch");
import * as path from "path";
import { types } from "vortex-api";

const blacklist = [
  path.join("**", "fomod", "*"),
  path.join("**", "readme*"),
  path.join("**", ".git", "**"),
  path.join("**", ".hgignore"),
  path.join("**", ".gitignore"),
  path.join("**", ".gitattributes"),
  path.join("**", "_macosx", "**", "*"),
  path.join("**", "meta.ini"), // Mod Organizer
  path.join("**", "mod.manifest"), // Kingdom Come: Deliverance
];

const getBlacklist = (() => {
  let lastGameId: string;
  let lastBlacklist: string[];
  return (game: types.IGame) => {
    if (game.id !== lastGameId) {
      lastGameId = game.id;
      const customBlacklist =
        game.details?.ignoreConflicts !== undefined &&
        Array.isArray(game.details.ignoreConflicts);
      const filterList = (item) => typeof item === "string";
      lastBlacklist = customBlacklist
        ? [].concat(
            blacklist,
            (game?.details?.ignoreConflicts || []).filter(filterList),
          )
        : blacklist;
    }

    return lastBlacklist;
  };
})();

function isBlacklisted(filePath: string, game: types.IGame): boolean {
  // TODO: this could become reaaaaly slow as the blacklist gets larger...
  return getBlacklist(game).some((pattern) =>
    minimatch(filePath, pattern, { nocase: true }),
  );
}

export default isBlacklisted;
