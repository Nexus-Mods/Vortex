import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';
import {IGameStored} from '../../gamemode_management/types/IGameStored';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';

import DelegateBase from './DelegateBase';

class Ini extends DelegateBase {
  private gameId: string;
  private gameInfo: IGameStored;
  private parser: IniParser;
  constructor(api: IExtensionApi, gameId: string) {
    super(api);
    this.gameId = gameId;
    this.gameInfo =
        getSafe(api.store.getState(), ['session', 'gameMode', 'known'], [])
            .find((game) => game.id === gameId);
    this.parser = new IniParser(new WinapiFormat());
  }

  public getIniString =
    (params: string[],
      callback: (err, res: string) => void) => {
    log('info', 'GetIniString called', '');

    let iniValue: string;
    let iniSection = params[1];
    let iniKey = params[2];

    this.parser.read(this.gameInfo.iniFilePath)
      .then((iniFile: IniFile<any>) => {
        Object.keys(iniFile.data).forEach((key: string) => {
          if (iniSection === key) {
            Object.keys(iniFile.data[key]).forEach((subkey: string) => {
              if (iniKey === subkey) {
                iniValue = iniFile.data[key][subkey];
              }
            });
          }
        });
      })
      .then(() => {
        return Promise.resolve(callback(null, iniValue));
      });
  }

  public getIniInt =
    (params: string[],
      callback: (err, res: number) => void) => {
    log('info', 'GetIniString called', '');

    let iniValue: number;
    let iniSection = params[1];
    let iniKey = params[2];

    this.parser.read(this.gameInfo.iniFilePath)
      .then((iniFile: IniFile<any>) => {
        Object.keys(iniFile.data).forEach((key: string) => {
          if (iniSection === key) {
            Object.keys(iniFile.data[key]).forEach((subkey: string) => {
              if (iniKey === subkey) {
                iniValue = +(iniFile.data[key][subkey]);
              }
            });
          }
        });
      })
      .then(() => {
        return Promise.resolve(callback(null, iniValue));
      });
  }
}

export default Ini;
