import * as fs from 'fs-extra-promise';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';

let parser = new IniParser(new WinapiFormat());

function init(context): boolean {

  context.once(() => {

    let events = context.api.events;

    events.on('oblivion-check-fonts',
      (oblivionIni: string, store: Redux.Store<any>) => {

        return parser.read(oblivionIni)
          .then((iniFile: IniFile<any>) => {
            let missingFonts: string[] = [];
            Object.keys(iniFile.data.Fonts).forEach((key: string) => {
              let fontFile: string = oblivionIni.concat(iniFile.data.Fonts[key]);
              if (!fs.existsSync(fontFile)) {
                missingFonts.push(fontFile);
              }
            });

            // console.log(missingFonts); 
          });
      });
  });

  return true;
}

export default init;
