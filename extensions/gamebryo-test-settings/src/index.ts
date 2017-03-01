import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';

let parser = new IniParser(new WinapiFormat());

function init(context): boolean {

  const testOblivionFonts = () => new Promise<types.ITestResult>((resolve, reject) => {

    const messages = 'List of missing fonts: ';
    // missing font Array

    return resolve({
      description: {
        short: 'Oblivion ini font not installed.',
        long: messages,
      },
      severity: 'error',
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        context.api.events.emit('show-modal', 'settings');
        context.api.events.on('hide-modal', (modal) => {
          if (modal === 'settings') {
            fixResolve();
          }
        });
      }),
    });
  });

  context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);

  context.once(() => {

    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if (gameId === 'skyrim') { // TODO LUCO Wrong check, waiting Oblivion
      checkOblivionFont(store, gameId);
    }
  });

  return true;
}

function checkOblivionFont(store: Redux.Store<types.IState>, gameId: string): Promise<string[]> {
  let oblivionIni = util.getSafe(store.getState(),
    ['settings', 'gameMode', 'discovered', gameId, 'path'],
    null).concat('\Oblivion_default.ini');

  return parser.read(oblivionIni)
    .then((iniFile: IniFile<any>) => {
      let missingFonts: string[] = [];
      Object.keys(iniFile.data.Fonts).forEach((key: string) => {
        let fontFile: string = oblivionIni.concat(iniFile.data.Fonts[key]);

        checkFont(fontFile)
          .then((result: boolean) => {
            if (!result) {
              missingFonts.push(fontFile);
            }
          });
      });
      // param check
      // console.log(missingFonts)

      return Promise.resolve(missingFonts);
    });
}

function checkFont(fontFile: string): Promise<boolean> {
  return fs.statAsync(fontFile)
  .then((stat: fs.Stats) => {
    return true;
  })
  .catch((err) => {
    return false;
  });
}

export default init;
