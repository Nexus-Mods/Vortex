import { log } from './log';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as winapi from 'winapi-bindings';
import * as fs from './fs';

import * as xmlParser from 'libxmljs';

import * as queryParser from 'querystring';

import turbowalk, { IEntry } from 'turbowalk';

import opn from './opn';

import { GameEntryNotFound, IGameStoreLauncher, ILauncherEntry } from '../types/api';

import { util } from '..';

const STORE_ID = 'origin';
const MANIFEST_EXT = '.mfst';

const INSTALLER_DATA = path.join('__Installer', 'installerdata.xml');
const ORIGIN_DATAPATH = 'c:\\ProgramData\\Origin\\';

const INSTALL_PATH_PATTERN = '&dipInstallPath=&dipinstallpath=';

/**
 * very limited functionality atm because so far the only source of information
 * I found was this ini file, and it contains no meta data about the games, not
 * even the installation path
 */
class OriginLauncher implements IGameStoreLauncher {
  public id: string;
  private mClientPath: Promise<string>;
  private mCache: Promise<ILauncherEntry[]>;

  constructor() {
    this.id = STORE_ID;
    if (process.platform === 'win32') {
      try {
        const clientPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\WOW6432Node\\Origin',
          'ClientPath');
        this.mClientPath = Promise.resolve(clientPath.value as string);
      } catch (err) {
        log('info', 'Origin launcher not found', { error: err.message });
        this.mClientPath = Promise.resolve(undefined);
      }
      const bla = this.allGames();
    } else {
      this.mClientPath = Promise.resolve(undefined);
    }
  }

  public launchGame(appId: string): Promise<void> {
    return this.getPosixPath(appId)
      .then(posPath => opn(posPath).catch(err => {
        log('debug', 'Origin game launch failed', err);
        return Promise.resolve();
      }));
  }

  public getPosixPath(name) {
    const posixPath = `origin2://game/launch?offerIds=${name}`;
    return Promise.resolve(posixPath);
  }

  public queryPath() {
    return this.mClientPath;
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public isGameInstalled(name: string): Promise<boolean> {
    return this.findByName(name)
      .then(() => Promise.resolve(true))
      .catch(err => Promise.resolve(false));
  }

  public findByAppId(appId): Promise<ILauncherEntry> {
    return this.allGames()
      .then(entries => entries.find(entry => entry.appid === appId))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(appId, STORE_ID))
        : Promise.resolve(entry));
  }

  public findByName(namePattern: string): Promise<ILauncherEntry> {
    const re = new RegExp(namePattern);
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(namePattern, STORE_ID))
        : Promise.resolve(entry));
  }

  public allGames(): Promise<ILauncherEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseLocalContent();
    }
    return this.mCache;
  }

  private getGameName(installerPath: string, encoding: string): Promise<string> {
    const regex = /\<title\>|\<\/title\>|™/gi;
    return fs.readFileAsync(installerPath, { encoding })
      .then(installerData => {
        let xmlDoc;
        try {
          xmlDoc = xmlParser.parseXml(installerData);
        } catch (err) {
          return Promise.reject(err);
        }
        const elements = xmlDoc.find('//game/metadata/localeInfo');
        const element = elements.find(entry => entry.attr('locale').value() === 'en_US');
        let name: string;
        if (element !== undefined) {
          name = element.find('title')[0].toString().replace('&amp;', '&');
          name = name.replace(regex, '');
        }

        return name !== undefined
          ? Promise.resolve(name)
          : Promise.reject(new Error('cannot find game name'));
      });
  }

  private parseLocalContent(): Promise<ILauncherEntry[]> {
    const localData = path.join(ORIGIN_DATAPATH, 'LocalContent');
    return turbowalk(localData, entries => {
      // Each game can have multiple manifest files (DLC and stuff)
      //  but only 1 manifest inside each game folder will have the
      //  game's installation path.
      const manifests = entries.filter(manifest =>
        path.extname(manifest.filePath) === MANIFEST_EXT);

      return Promise.reduce(manifests, (accum: ILauncherEntry[], manifest: IEntry) =>
        fs.readFileAsync(manifest.filePath, { encoding: 'utf-8' })
          .then(data => {
            if (data.indexOf(INSTALL_PATH_PATTERN) !== -1) {
              let query;
              try {
                // Ignore the preceding '?'
                query = queryParser.parse(data.substr(1));
              } catch (err) {
                log('error', 'failed to parse manifest file', err);
                return accum;
              }

              if (!!query.dipinstallpath && !!query.id) {
                // We have the installation path and the game's ID which we can
                //  use to launch the game, but we need the game's name as well.
                const gamePath = query.dipinstallpath as string;
                const appid = query.id as string;
                const installerFilepath = path.join(gamePath, INSTALLER_DATA);
                return this.getGameName(installerFilepath, 'utf-8')
                  .catch(err => this.getGameName(installerFilepath, 'utf16le'))
                  .then(name => {
                    // We found the name.
                    const launcherEntry: ILauncherEntry = {
                      name, appid, gamePath, gameStoreId: STORE_ID,
                    };

                    accum.push(launcherEntry);
                    return accum;
                  })
                  .catch(err => {
                    log('error', `failed to find game name for ${appid}`, err);
                    return accum;
                  });
              }
            }
            return accum;
          }), []);
    });
  }
}

const instance: IGameStoreLauncher =
  process.platform === 'win32' ?  new OriginLauncher() : undefined;

export default instance;
