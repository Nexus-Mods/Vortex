import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';
import {isNullOrWhitespace} from '../../../util/util';

import {IGameStored} from '../../gamemode_management/types/IGameStored';

import { getIniFilePath } from '../util/gameSupport';

import DelegateBase from './DelegateBase';

import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';
import { inspect } from 'util';

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
      (params: string[], callback: (err, res: string) => void) => {
        log('debug', 'GetIniString called', inspect(params));

        let iniValue: string;
        const selectedFile = params[0];
        const iniSection = params[1];
        const iniKey = params[2];
        let baseIniFile = getIniFilePath(this.gameInfo.id);

        if (!isNullOrWhitespace(selectedFile)) {
          baseIniFile = path.join(path.dirname(baseIniFile), selectedFile);
        }

        this.parser.read(baseIniFile)
            .then((iniFile: IniFile<any>) => {
              Object.keys(iniFile.data)
                  .forEach((key: string) => {
                    if (iniSection === key) {
                      Object.keys(iniFile.data[key])
                          .forEach((subkey: string) => {
                            if (iniKey === subkey) {
                              iniValue = iniFile.data[key][subkey];
                            }
                          });
                    }
                  });
            })
            .then(() => Promise.resolve(callback(null, iniValue)));
      }

  public getIniInt = (params: string[],
                      callback: (err, res: number) => void) => {
    log('debug', 'GetIniString called', inspect(params));

    let iniValue: number;
    const selectedFile = params[0];
    const iniSection = params[1];
    const iniKey = params[2];
    let baseIniFile = getIniFilePath(this.gameInfo.id);

    if (!isNullOrWhitespace(selectedFile)) {
      baseIniFile = path.join(path.dirname(baseIniFile), selectedFile);
    }

    this.parser.read(baseIniFile)
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
