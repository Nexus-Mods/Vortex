import { iniPath } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';

let parser = new IniParser(new WinapiFormat());

const oblivionDefaultFonts: string[] = [
  'Data\\Fonts\\Kingthings_Regular.fnt',
  'Data\\Fonts\\Kingthings_Shadowed.fnt',
  'Data\\Fonts\\Tahoma_Bold_Small.fnt',
  'Data\\Fonts\\Daedric_Font.fnt',
  'Data\\Fonts\\Handwritten.fnt',
];

function init(context): boolean {

  const testOblivionFonts = () => new Promise<types.ITestResult>((resolve, reject) => {
    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if (gameId !== 'oblivion') {
      return resolve(undefined);
    }

    let messages = 'List of missing fonts: ';

    checkOblivionFont(store, gameId)
      .then((missingFonts: string[]) => {

        if (missingFonts.length === 0) {
          return resolve(undefined);
        }

        missingFonts.forEach(font => {
          messages = messages.concat('\n ' + font);
        });

        return resolve({
          description: {
            short: 'Oblivion ini font not installed.',
            long: messages,
          },
          severity: 'error',
        });
      });
  });

  context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);

  return true;
}

function checkOblivionFont(store: Redux.Store<types.IState>, gameId: string): Promise<string[]> {

  let missingFonts: string[] = [];

  let currentProfile = selectors.activeProfile(store.getState());
  return parser.read(iniPath(currentProfile.gameId))
    .then((iniFile: IniFile<any>) => {
      let fonts: string[] = [];
      Object.keys(iniFile.data.Fonts).forEach((key: string) => {
        if (oblivionDefaultFonts.find((item) => item === iniFile.data.Fonts[key]) === undefined) {
          fonts.push(iniFile.data.Fonts[key]);
        }
      });

      return Promise.each(fonts, (font: string) => {
        let fontFile: string = path.join(path.dirname(iniPath(currentProfile.gameId)), font);
        return fs.statAsync(fontFile)
          .catch(() => {
            missingFonts.push(fontFile);
          });
      });
    })
    .then(() => {
      return Promise.resolve(missingFonts);
    });
}

export default init;
