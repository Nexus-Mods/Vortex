import Promise from "bluebird";
import * as path from "path";
import * as Redux from "redux";
import { fs, selectors, types } from "vortex-api";
import { IniFile } from "vortex-parse-ini";

export const oblivionDefaultFonts = {
  sfontfile_1: "Data\\Fonts\\Kingthings_Regular.fnt",
  sfontfile_2: "Data\\Fonts\\Kingthings_Shadowed.fnt",
  sfontfile_3: "Data\\Fonts\\Tahoma_Bold_Small.fnt",
  sfontfile_4: "Data\\Fonts\\Daedric_Font.fnt",
  sfontfile_5: "Data\\Fonts\\Handwritten.fnt",
};

const defaultFontSet = new Set(
  Object.values(oblivionDefaultFonts).map((font) => font.toLowerCase()),
);

function missingOblivionFont(
  store: Redux.Store<types.IState>,
  iniFile: IniFile<any>,
  gameId: string,
): Promise<string[]> {
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(
    store.getState(),
    gameId,
  );
  if (discovery === undefined || discovery.path === undefined) {
    // not this extensions job to report game not being discovered
    return Promise.resolve([]);
  }

  const missingFonts: string[] = [];

  const fonts: string[] = [];
  Object.keys(iniFile.data.Fonts || {}).forEach((key: string) => {
    if (!defaultFontSet.has(iniFile.data.Fonts[key].toLowerCase())) {
      fonts.push(iniFile.data.Fonts[key]);
    }
  });

  return Promise.each(fonts, (font: string) =>
    fs.statAsync(path.join(discovery.path, font)).catch(() => {
      missingFonts.push(font);
    }),
  ).then(() => Promise.resolve(missingFonts));
}

export default missingOblivionFont;
