import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types, util } from 'nmm-api';
import * as path from 'path';

function missingSkyrimFonts(state: types.IState, skyrimDefaultFonts: Set<string>,
                            gameId: string): Promise<string[]> {
  const gameDiscovery: types.IDiscoveryResult = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', gameId], undefined);
  const fontconfigTxt = path.join(gameDiscovery.modPath, 'interface', 'fontconfig.txt');

  return fs.readFileAsync(fontconfigTxt)
    .then((fontconfig: NodeBuffer) => {
      // extract fonts from fontlib lines
      let rows = fontconfig.toString().split('\n');
      const fonts: string[] =
        rows.filter(row => row.startsWith('fontlib '))
            .map(row => row.trim().replace(/^fontlib +["'](.*)["'].*/, '$1').toLowerCase());

      // filter the known fonts shipped with the game
      let removedFonts = fonts
        .filter((font: string) => !skyrimDefaultFonts.has(font));

      // test the remaining files for existence
      // TODO: I guess we should also check in bsas, right?
      return Promise.map(removedFonts, (font: string) => {
        const fontFile: string = path.join(gameDiscovery.modPath, font);
        return fs.statAsync(fontFile)
          .then(() => null)
          .catch(() => fontFile);
      });
    })
    .then((missingFonts: string[]) =>
      Promise.resolve(missingFonts.filter(font => font !== null))
    )
    // assume any error reading/parsing the file is an error on our end not in the file
    .catch(() => Promise.resolve([]));
}

export default missingSkyrimFonts;
