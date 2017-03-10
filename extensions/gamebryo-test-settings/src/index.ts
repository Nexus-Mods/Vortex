import checkOblivionFont, { oblivionDefaultFonts } from './util/checkOblivionFonts';
import checkSkyrimFonts from './util/checkSkyrimFonts';
import { iniPath } from './util/gameSupport';

import * as Promise from 'bluebird';
import { selectors, types } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';

let parser = new IniParser(new WinapiFormat());
let oblivionIni: IniFile<any>;

function init(context): boolean {

  const testOblivionFonts = (): Promise<types.ITestResult> => {
    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if (gameId !== 'oblivion') {
      return Promise.resolve(undefined);
    }

    return checkOblivionFont(store, gameId)
      .then((missingFonts: string[]) => {

        if (missingFonts.length === 0) {
          return Promise.resolve(undefined);
        }

        let currentProfile = selectors.activeProfile(store.getState());

        const fontList = missingFonts.join('\n');


        return Promise.resolve({
          description: {
            short: 'Fonts missing.',
            long: 'Fonts referenced in oblivion.ini don\'t seem to be installed:\n' + fontList,
          },
          severity: 'error' as types.ProblemSeverity,
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
      })
      .catch((err: Error) => {
         return Promise.resolve({
          description: {
            short: 'Failed to read Oblivion.ini.',
            long: err.toString(),
          },
          severity: 'error' as types.ProblemSeverity,
        });
    });
  };

  const testSkyrimFonts = (): Promise<types.ITestResult> => {
    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if ((gameId !== 'skyrim') && (gameId !== 'skyrimse')) {
      return Promise.resolve(undefined);
    }

    return checkSkyrimFonts(store.getState(), gameId)
      .then((missingFonts: string[]) => {

        if (missingFonts.length === 0) {
          return Promise.resolve(undefined);
        }

        const fontList = missingFonts.join('\n');

        return Promise.resolve({
          description: {
            short: 'Fonts missing.',
            long: 'Fonts referenced in fontconfig.txt don\'t seem to be installed:\n' + fontList,
          },
          severity: 'error' as types.ProblemSeverity,
        });
      })
      .catch((err: Error) => {
        return Promise.resolve({
          description: {
            short: 'Failed to read fontconfig.txt.',
            long: err.toString(),
          },
          severity: 'error' as types.ProblemSeverity,
        });
    });
  };

  context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);
  context.registerTest('skyrim-fonts', 'gamemode-activated', testSkyrimFonts);

  return true;
}

export default init;
