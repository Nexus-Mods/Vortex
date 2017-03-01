import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';

let parser = new IniParser(new WinapiFormat());

function init(context): boolean {

  const testOblivionFonts = () => new Promise<types.ITestResult>((resolve, reject) => {

    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    const messages = 'List of missing fonts: ';

    checkOblivionFont(store, gameId)
      .then((missingFonts: string[]) => {

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

      return Promise.resolve(missingFonts);
    });
}

function checkFont(fontFile: string): Promise<boolean> {
  return fs.statAsync(fontFile)
    .then((stat: fs.Stats) => {
      return Promise.resolve(true);
    })
    .catch((err) => {
      return Promise.resolve(false);
    });
}

export default init;
