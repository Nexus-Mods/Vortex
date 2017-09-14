import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {currentGameDiscovery} from '../../../util/selectors';
import {getSafe} from '../../../util/storeHelper';
import {isNullOrWhitespace} from '../../../util/util';

import {IDiscoveryResult} from '../../gamemode_management/types/IDiscoveryResult';
import {IGameStored} from '../../gamemode_management/types/IGameStored';

import DelegateBase from './DelegateBase';

import * as Promise from 'bluebird';
import { app as appIn, remote} from 'electron';
import getVersion from 'exe-version';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as util from 'util';

const app = appIn || remote.app;

function extenderForGame(gameId: string) {
  return {
    oblivion: 'obse',
    skyrim: 'skse',
    skyrimse: 'skse64',
    fallout3: 'fose',
    falloutnv: 'nvse',
    fallout4: 'f4se',
  }[gameId];
}

export class Context extends DelegateBase {
  private gameId: string;
  private gameDiscovery: IDiscoveryResult;
  private gameInfo: IGameStored;
  constructor(api: IExtensionApi, gameId: string) {
    super(api);
    this.gameId = gameId;

    this.gameDiscovery =
        getSafe(api.store.getState(),
                ['settings', 'gameMode', 'discovered', gameId], undefined);
    this.gameInfo =
        getSafe(api.store.getState(), ['session', 'gameMode', 'known'], [])
            .find((game) => game.id === gameId);
    if (this.gameDiscovery === undefined) {
      throw new Error(`game (${gameId}) not installed`);
    }
  }

  public getAppVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', 'getAppVersion called');
        return callback(null, app.getVersion());
      }

  public getCurrentGameVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', 'getCurrentGameVersion called');
        const executable = this.gameDiscovery.executable || this.gameInfo.executable;
        const gameExePath =
            path.join(this.gameDiscovery.path, executable);
        return callback(null, getVersion(gameExePath));
      }

  public getExtenderVersion =
      (extender: string, callback: (err, res: string) => void) => {
        log('debug', 'getExtenderVersion called');
        const sePath = path.join(this.gameDiscovery.path, `${extender}_loader.exe`);
        return callback(null, getVersion(sePath));
      }

  public isExtenderPresent =
      (par: any, callback: (err, res: boolean) => void) => {
        log('debug', 'isExtenderPresent called');
        const extender = extenderForGame(this.gameId);
        if (extender === undefined) {
          return callback(null, false);
        }

        const sePath = path.join(this.gameDiscovery.path, `${extender}_loader.exe`);
        fs.statAsync(sePath)
        .then(() => callback(null, true))
        .catch(() => callback(null, false));
      }

  public checkIfFileExists =
      (fileName: string, callback: (err, res: boolean) => void) => {
        log('debug', 'checkIfFileExists called', util.inspect(fileName));
        const state = this.api.store.getState();
        const currentGameInfo = currentGameDiscovery(state);
        const fullFilePath = path.join(currentGameInfo.modPath, fileName);

        fs.statAsync(fullFilePath)
            .reflect()
            .then((stat) => callback(null, stat.isFulfilled()));
      }

  public getExistingDataFile =
      (fileName: string, callback: (err, res: any) => void) => {
        log('debug', 'getExistingDataFile called', util.inspect(fileName));
        const state = this.api.store.getState();
        const currentGameInfo = currentGameDiscovery(state);
        const fullFilePath = path.join(currentGameInfo.modPath, fileName);

        fs.readFileAsync(fullFilePath)
            .then((readBytes) => callback(null, readBytes))
            .catch(() => callback(null, null));
      }

  public getExistingDataFileList =
      (searchOptions: any[], callback: (err, res: string[]) => void) => {
        log('debug', 'getExistingDataFileList called', util.inspect(searchOptions[0]));
        const state = this.api.store.getState();
        const currentGameInfo = currentGameDiscovery(state);
        const fullFilePath = path.join(currentGameInfo.modPath, searchOptions[0]);

        if (searchOptions[2] === true) {
          this.readDirRecursive(fullFilePath, searchOptions[1])
            .then((fileList) => callback(null, fileList))
            .catch(() => callback(null, null));
        } else {
          fs.readdirAsync(fullFilePath)
            .then((fileList) => callback(null, fileList))
            .catch(() => callback(null, null));
        }
      }

  private readDirRecursive = (rootFolder: string,
                              filter: string): Promise<string[]> => {
    const fileList: string[] = [];
    fs.readdirAsync(rootFolder)
        .then((folderContent) => folderContent.forEach((fileName) => {
          const subFolder = path.join(rootFolder, fileName);
          fs.statAsync(subFolder).then((stats) => {
            if (stats.isDirectory()) {
              this.readDirRecursive(subFolder, filter)
                  .then((subList) => fileList.push.apply(fileList, subList));
            } else {
              if (!isNullOrWhitespace(filter)) {
                const currentFileName = path.basename(fileName);
                if (currentFileName.indexOf(filter) > -1) {
                  fileList.push(fileName);
                }
              } else {
                fileList.push(fileName);
              }
            }
          });
        }));
    return Promise.resolve(fileList);
  }
}

export default Context;
