import * as Promise from 'bluebird';
import Registry = require('winreg');

import { log } from './log';
import { getSafe } from './storeHelper';

import * as fs from 'fs-extra-promise';
import * as path from 'path';

import { app as appIn, remote } from 'electron';

import { parse } from 'simple-vdf';

let app = appIn || remote.app;

export interface ISteamEntry {
  name: string;
  gamePath: string;
}

/**
 * base class to interact with local steam installation
 * 
 * @class Steam
 */
class Steam {

  private mBaseFolder: Promise<string>;

  constructor() {
    if (process.platform === 'win32') {
      // windows
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Valve\\Steam',
      });

      this.mBaseFolder = new Promise<string>((resolve, reject) => {
        regKey.get('SteamPath', (err: Error, result: Registry.RegistryItem) => {
          if (err !== null) {
            reject(new Error(err.message));
          } else {
            resolve(result.value);
          }
        });
      });
    } else {
      this.mBaseFolder = Promise.resolve(path.resolve(app.getPath('home'), '.steam', 'steam'));
    }
  }

  public allGames(): Promise<ISteamEntry[]> {
    let steamPaths: string[] = [];
    return this.mBaseFolder
    .then((basePath: string) => {
      steamPaths.push(basePath);
      return fs.readFileAsync(path.resolve(basePath, 'config', 'config.vdf'));
    })
    .then((data: NodeBuffer) => {
      let configObj: Object = parse(data.toString());

      let counter = 1;
      let steamObj: Object =
        getSafe(configObj, ['InstallConfigStore', 'Software', 'Valve', 'Steam'], {});
      while (steamObj.hasOwnProperty(`BaseInstallFolder_${counter}`)) {
        steamPaths.push(steamObj[`BaseInstallFolder_${counter}`]);
        ++counter;
      }

      log('debug', 'steam base folders', { steamPaths });

      return Promise.all(Promise.map(steamPaths, (steamPath) => {
        let appPath: string = path.join(steamPath, 'steamapps', 'common');
        return fs.readdirAsync(appPath)
        .then((names: string[]) => {
          return names.map((name: string) => {
            return { name, gamePath: path.join(appPath, name) };
          });
        });
      }));
    })
    .then((games: ISteamEntry[][]) => {
      return games.reduce((prev: ISteamEntry[], current: ISteamEntry[]): ISteamEntry[] => {
        return prev.concat(current);
      });
    });
  }
}

export default Steam;
