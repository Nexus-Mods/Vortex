import { iniPath } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';

let parser = new IniParser(new WinapiFormat());
let oblivionIni: IniFile<any>;

const oblivionDefaultFonts = {
  'SFontFile_1': 'Data\\Fonts\\Kingthings_Regular.fnt',
  'SFontFile_2': 'Data\\Fonts\\Kingthings_Shadowed.fnt',
  'SFontFile_3': 'Data\\Fonts\\Tahoma_Bold_Small.fnt',
  'SFontFile_4': 'Data\\Fonts\\Daedric_Font.fnt',
  'SFontFile_5': 'Data\\Fonts\\Handwritten.fnt',
};

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

        let currentProfile = selectors.activeProfile(store.getState());

        missingFonts.forEach(font => {
          let fontFile: string = path.join(path.dirname(iniPath(currentProfile.gameId)), font);
          messages = messages.concat('\n ' + fontFile);
        });

        return resolve({
          description: {
            short: 'Oblivion ini font not installed.',
            long: messages,
          },
          severity: 'error',
          automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
            Object.keys(oblivionIni.data.Fonts).forEach((key) => {
              if (missingFonts.find((item) => {
                return item === oblivionIni.data.Fonts[key];
              }) !== undefined) {
                if (oblivionDefaultFonts[key] !== undefined) {
                  oblivionIni.data.Fonts[key] = oblivionDefaultFonts[key];
                } else {
                  delete oblivionIni.data.Fonts[key];
                }
              }
            });

            parser.write(iniPath(currentProfile.gameId), oblivionIni);
            fixResolve();
          }),
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
      oblivionIni = iniFile;
      let fonts: string[] = [];
      Object.keys(oblivionIni.data.Fonts).forEach((key: string) => {
        if (oblivionDefaultFonts[key] !== oblivionIni.data.Fonts[key]) {
          fonts.push(oblivionIni.data.Fonts[key]);
        }
      });

      return Promise.each(fonts, (font: string) => {
        let fontFile: string = path.join(path.dirname(iniPath(currentProfile.gameId)), font);
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

export default init;
