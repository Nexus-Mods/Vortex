import { log } from './log';

import * as Promise from 'bluebird';
import * as path from 'path';
import IniParser, { WinapiFormat } from 'vortex-parse-ini';

export interface IEpicGamesLauncher {
  isGameInstalled(name: string): Promise<boolean>;
}

/**
 * very limited functionality atm because so far the only source of information
 * I found was this ini file, and it contains no meta data about the games, not even the installation path
 */
class EpicGamesLauncher implements IEpicGamesLauncher {
  private mConfig: Promise<{ data: any }>;
  constructor() {
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name 
   */
  public isGameInstalled(name: string): Promise<boolean> {
    return this.config.then(ini => {
      if (ini.data === undefined) {
        return false;
      }
      const settingsKey = Object.keys(ini.data).find(key => key.endsWith('_Settings'));
      if (ini.data[settingsKey] === undefined) {
        return false;
      }
      return Object.keys(ini.data[settingsKey]).indexOf(`${name}_AutoUpdate`) !== -1;
    });
  }

  private get config(): Promise<{ data: any }> {
    if (this.mConfig === undefined) {
      const configPath = path.join(process.env['LOCALAPPDATA'], 'EpicGamesLauncher', 'Saved', 'Config', 'Windows', 'GameUserSettings.ini');
      let ini = new IniParser(new WinapiFormat);
      this.mConfig = ini.read(configPath)
        .catch({ code: 'ENOENT' }, err => {
          log('info', 'Epic Games Launcher not installed');
          return { data: {} };
        })
        .catch(err => {
          log('error', 'Failed to read epic games launcher config', err);
          return { data: {} };
        });
    }

    return this.mConfig;
  }
}

const instance: IEpicGamesLauncher = process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
