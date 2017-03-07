import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

const skyrimDefaultFonts = [
  'Interface\\fonts_console.swf',
  'Interface\\fonts_en.swf',
  'Interface\\fonts_en2.swf',
];

function checkSkyrimFonts(
  store: Redux.Store<types.IState>,
  gameId: string): Promise<string[]> {

  let missingFonts: string[] = [];
  let currentProfile = selectors.activeProfile(store.getState());
  let gamePath = util.getSafe(store.getState(),
    ['settings', 'gameMode', 'discovered', currentProfile.gameId], undefined);
  let fontconfigTxt = path.join(gamePath.path, 'Data\\Interface\\fontconfig.txt');
  let fonts: string[] = [];

  return fs.readFileAsync(fontconfigTxt)
    .then((fontconfig: NodeBuffer) => {
      let textRows = fontconfig.toString().split('\n');
      textRows.forEach(row => {
        if (row.startsWith('fontlib ')) {
          fonts.push(row.trim().replace(/^fontlib +["'](.*)["'].*/, '$1'));
        }
      });

      let removedFonts = fonts.filter((font: string) =>
        skyrimDefaultFonts.indexOf(font) === -1);

      return Promise.each(removedFonts, (font: string) => {
        let fontFile: string = path.join(gamePath.path, font);
        return fs.statAsync(fontFile)
          .catch(() => {
            missingFonts.push(font);
          });
      });

    })
    .then(() => {
      return Promise.resolve(missingFonts);
    });
}

export default checkSkyrimFonts;
