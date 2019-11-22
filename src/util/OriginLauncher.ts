import { log } from './log';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as winapi from 'winapi-bindings';
import * as fs from './fs';

import * as xmlParser from 'libxmljs';

import * as queryParser from 'querystring';

import turbowalk, { IEntry } from 'turbowalk';

import opn from './opn';

import { GameEntryNotFound, IGameStore, IGameStoreEntry } from '../types/api';

const STORE_ID = 'origin';
const MANIFEST_EXT = '.mfst';

const INSTALLER_DATA = path.join('__Installer', 'installerdata.xml');
const ORIGIN_DATAPATH = 'c:\\ProgramData\\Origin\\';

const INSTALL_PATH_PATTERN = '&dipInstallPath=&dipinstallpath=';

export class MissingXMLElementError extends Error {
  private mElementName: string;
  constructor(elementName: string) {
    super('Missing XML element');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mElementName = elementName;
  }

  public get elementName() {
    return this.mElementName;
  }
}

/**
 * very limited functionality atm because so far the only source of information
 * I found was this ini file, and it contains no meta data about the games, not
 * even the installation path
 */
class OriginLauncher implements IGameStore {
  public id: string;
  private mClientPath: Promise<string>;
  private mCache: Promise<IGameStoreEntry[]>;

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

  public findByAppId(appId): Promise<IGameStoreEntry> {
    return this.allGames()
      .then(entries => entries.find(entry => entry.appid === appId))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(appId, STORE_ID))
        : Promise.resolve(entry));
  }

  public findByName(namePattern: string): Promise<IGameStoreEntry> {
    const re = new RegExp(namePattern);
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(namePattern, STORE_ID))
        : Promise.resolve(entry));
  }

  public allGames(): Promise<IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseLocalContent();
    }
    return this.mCache;
  }

  // 3rd party game companies seem to generate their game
  //  "DiP" manifest using a tool called EAInstaller, this
  //  is the function we should be using _first_ when querying
  //  the game's name as most games would be developed by non-EA
  //  companies.
  private getGameNameDiP(installerPath: string, encoding: string): Promise<string> {
    return fs.readFileAsync(installerPath, { encoding })
      .then(installerData => {
        let xmlDoc;
        try {
          xmlDoc = xmlParser.parseXml(installerData);
        } catch (err) {
          return Promise.reject(err);
        }

        const elements = xmlDoc.find('//DiPManifest/gameTitles/gameTitle');
        const element = elements.find(entry => entry.attr('locale').value() === 'en_US');
        return element !== undefined
          ? Promise.resolve(element.text())
          : Promise.reject(new MissingXMLElementError('gameTitle(en_US)'));
      });
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
          : Promise.reject(new MissingXMLElementError('localeInfo(en_US)/title'));
      });
  }

  private parseLocalContent(): Promise<IGameStoreEntry[]> {
    const localData = path.join(ORIGIN_DATAPATH, 'LocalContent');
    return new Promise((resolve, reject) => {
      turbowalk(localData, entries => {
      // Each game can have multiple manifest files (DLC and stuff)
      //  but only 1 manifest inside each game folder will have the
      //  game's installation path.
      const manifests = entries.filter(manifest =>
        path.extname(manifest.filePath) === MANIFEST_EXT);

      return Promise.reduce(manifests, (accum: IGameStoreEntry[], manifest: IEntry) =>
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
                return Promise.any([this.getGameNameDiP(installerFilepath, 'utf-8'),
                                    this.getGameNameDiP(installerFilepath, 'utf16le'),
                                    this.getGameName(installerFilepath, 'utf-8'),
                                    this.getGameName(installerFilepath, 'utf16le')])
                  .then(name => {
                    // We found the name.
                    const launcherEntry: IGameStoreEntry = {
                      name, appid, gamePath, gameStoreId: STORE_ID,
                    };

                    accum.push(launcherEntry);
                    return accum;
                  })
                  .catch(err => {
                    const meta = Array.isArray(err)
                      ? err.map(errInst => errInst.message).join(';')
                      : err;

                    log('error', `failed to find game name for ${appid}`, meta);
                    return accum;
                  });
              }
            }
            return accum;
          }), [])
          // tslint:disable-next-line: no-shadowed-variable
          .then(entries => resolve(entries));
      });
    });
  }
}

const instance: IGameStore =
  process.platform === 'win32' ?  new OriginLauncher() : undefined;

export default instance;
