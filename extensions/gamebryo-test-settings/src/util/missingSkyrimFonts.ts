import Promise from "bluebird";
import * as path from "path";
import { fs, types, util } from "vortex-api";

function missingSkyrimFonts(
  state: types.IState,
  skyrimDefaultFonts: Set<string>,
  gameId: string,
): Promise<string[]> {
  const gameDiscovery: types.IDiscoveryResult = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  );
  const game = util.getGame(gameId);
  const modPath = game.getModPaths(gameDiscovery.path)[""];
  const fontconfigTxt = path.join(modPath, "interface", "fontconfig.txt");

  return (
    fs
      .readFileAsync(fontconfigTxt)
      .then((fontconfig: Buffer) => {
        // extract fonts from fontlib lines
        const rows = fontconfig.toString().split("\n");
        const fonts: string[] = rows
          .filter((row) => row.startsWith("fontlib "))
          .map((row) =>
            row
              .trim()
              .replace(/^fontlib +["'](.*)["'].*/, "$1")
              .toLowerCase(),
          );

        // filter the known fonts shipped with the game
        const removedFonts = fonts.filter(
          (font: string) => !skyrimDefaultFonts.has(font),
        );

        // test the remaining files for existence
        // TODO: I guess we should also check in bsas, right?
        return Promise.map(removedFonts, (font: string) => {
          const fontFile: string = path.join(modPath, font);
          return fs
            .statAsync(fontFile)
            .then(() => null)
            .catch(() => fontFile);
        });
      })
      .then((missingFonts: string[]) =>
        Promise.resolve(missingFonts.filter((font) => font !== null)),
      )
      // assume any error reading/parsing the file is an error on our end not in the file
      .catch(() => Promise.resolve<string[]>([]))
  );
}

export default missingSkyrimFonts;
