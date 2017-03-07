import { iniPath } from './gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';

let parser = new IniParser(new WinapiFormat());
let oblivionIni: IniFile<any>;

export const oblivionDefaultFonts = {
  'SFontFile_1': 'Data\\Fonts\\Kingthings_Regular.fnt',
  'SFontFile_2': 'Data\\Fonts\\Kingthings_Shadowed.fnt',
  'SFontFile_3': 'Data\\Fonts\\Tahoma_Bold_Small.fnt',
  'SFontFile_4': 'Data\\Fonts\\Daedric_Font.fnt',
  'SFontFile_5': 'Data\\Fonts\\Handwritten.fnt',
};

function checkOblivionFont(store: Redux.Store<types.IState>,
                           gameId: string): Promise<string[]> {

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

export default checkOblivionFont;
