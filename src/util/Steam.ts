import * as Promise from 'bluebird';
import Registry = require('winreg');

import * as fs from './fs';
import { log } from './log';
import { getSafe } from './storeHelper';

import * as path from 'path';

import { app as appIn, remote } from 'electron';

import { parse } from 'simple-vdf';

const app = (remote !== undefined) ? remote.app : appIn;

export interface ISteamEntry {
  appid: string;
  name: string;
  gamePath: string;
  lastUpdated: Date;
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
    const steamPaths: string[] = [];
    return this.mBaseFolder
      .then((basePath: string) => {
        steamPaths.push(basePath);
        return fs.readFileAsync(path.resolve(basePath, 'config', 'config.vdf'));
      })
      .then((data: NodeBuffer) => {
        const configObj: any = parse(data.toString());

        let counter = 1;
        const steamObj: any =
          getSafe(configObj, ['InstallConfigStore', 'Software', 'Valve', 'Steam'], {});
        while (steamObj.hasOwnProperty(`BaseInstallFolder_${counter}`)) {
          steamPaths.push(steamObj[`BaseInstallFolder_${counter}`]);
          ++counter;
        }

        log('debug', 'steam base folders', { steamPaths });

        return Promise.all(Promise.map(steamPaths, steamPath => {
          const steamAppsPath = path.join(steamPath, 'steamapps');
          return fs.readdirAsync(steamAppsPath)
            .then(names => {
              const filtered = names.filter(name =>
                name.startsWith('appmanifest_') && (path.extname(name) === '.acf'));
              return Promise.map(filtered, (name: string) =>
                fs.readFileAsync(path.join(steamAppsPath, name)));
            })
            .then((appsData: NodeBuffer[]) => {
              return appsData.map(appData => parse(appData.toString())).map(obj =>
                ({
                  appid: obj['AppState']['appid'],
                  name: obj['AppState']['name'],
                  gamePath: path.join(steamAppsPath, 'common', obj['AppState']['installdir']),
                  lastUpdated: new Date(obj['AppState']['LastUpdated'] * 1000),
                }));
            });
        }));
      })
      .then((games: ISteamEntry[][]) =>
        games.reduce((prev: ISteamEntry[], current: ISteamEntry[]): ISteamEntry[] =>
          prev.concat(current)));
  }
}

export default Steam;
