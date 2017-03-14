import { iniPath } from './gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types } from 'nmm-api';
import { IniFile } from 'parse-ini';
import * as path from 'path';

export const oblivionDefaultFonts = {
  'SFontFile_1': 'Data\\Fonts\\Kingthings_Regular.fnt',
  'SFontFile_2': 'Data\\Fonts\\Kingthings_Shadowed.fnt',
  'SFontFile_3': 'Data\\Fonts\\Tahoma_Bold_Small.fnt',
  'SFontFile_4': 'Data\\Fonts\\Daedric_Font.fnt',
  'SFontFile_5': 'Data\\Fonts\\Handwritten.fnt',
};

function missingOblivionFont(store: Redux.Store<types.IState>,
                             iniFile: IniFile,
                             gameId: string): Promise<string[]> {
  let missingFonts: string[] = [];

  let fonts: string[] = [];
  Object.keys(iniFile.data.Fonts)
      .forEach((key: string) => {
        if (oblivionDefaultFonts[key] !== iniFile.data.Fonts[key]) {
          fonts.push(iniFile.data.Fonts[key]);
        }
      });

  let gameIniPath = path.dirname(iniPath(gameId));

  return Promise.each(fonts, (font: string) =>
                                 fs.statAsync(path.join(gameIniPath, font))
                                     .catch(() => { missingFonts.push(font); }))
      .then(() => Promise.resolve(missingFonts));
}

export default missingOblivionFont;
