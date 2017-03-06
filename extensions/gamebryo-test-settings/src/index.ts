import { checkOblivionFont, oblivionDefaultFonts } from './util/checkOblivionFonts';
import { checkSkyrimFont } from './util/checkSkyrimFonts';
import { iniPath } from './util/gameSupport';

import * as Promise from 'bluebird';
import { selectors, types } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';

let parser = new IniParser(new WinapiFormat());
let oblivionIni: IniFile<any>;

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

  const testSkyrimFonts = () => new Promise<types.ITestResult>((resolve, reject) => {
    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if ((gameId !== 'skyrim') && (gameId !== 'skyrimse')) {
      return resolve(undefined);
    }

    let messages = 'List of missing fonts: ';

    checkSkyrimFont(store, gameId)
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
            short: 'Fontconfig txt font not installed.',
            long: messages,
          },
          severity: 'error',
        });
      });
  });

  context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);
  context.registerTest('skyrim-fonts', 'gamemode-activated', testSkyrimFonts);

  return true;
}

export default init;
