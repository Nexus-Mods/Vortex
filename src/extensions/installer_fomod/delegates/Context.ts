import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {currentGameDiscovery} from '../../../util/selectors';
import {getSafe} from '../../../util/storeHelper';

import {IDiscoveryResult} from '../../gamemode_management/types/IDiscoveryResult';
import {IGameStored} from '../../gamemode_management/types/IGameStored';

import DelegateBase from './DelegateBase';

import * as Promise from 'bluebird';
import { app as appIn, remote} from 'electron';
import getVersion from 'exe-version';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as util from 'util';

let app = appIn || remote.app;

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
    if ((this.gameDiscovery === undefined) || (this.gameInfo === undefined)) {
      throw new Error('game not installed');
    }
  }

  public getAppVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('info', 'getAppVersion called', '');
        return callback(null, app.getVersion());
      }

  public getCurrentGameVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('info', 'getCurrentGameVersion called', '');
        const gameExePath =
            path.join(this.gameDiscovery.path, this.gameInfo.executable);
        return callback(null, getVersion(gameExePath));
      }

  public getExtenderVersion =
      (extender: string, callback: (err, res: string) => void) => {
        const sePath = path.join(this.gameDiscovery.path, `${extender}_loader.exe`);
        return callback(null, getVersion(sePath));
      }

  public isExtenderPresent =
      (par: any, callback: (err, res: boolean) => void) => {
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
        log('info', 'checkIfFileExists called', util.inspect(fileName));
        let state = this.api.store.getState();
        let currentGameInfo = currentGameDiscovery(state);
        let fullFilePath = path.join(currentGameInfo.modPath, fileName);

        fs.statAsync(fullFilePath)
            .reflect()
            .then((stat) => callback(null, stat.isFulfilled()));
      }

    public getExistingDataFile =
      (fileName: string, callback: (err, res: any ) => void) => {
        log('info', 'getExistingDataFile called', util.inspect(fileName));
        let state = this.api.store.getState();
        let currentGameInfo = currentGameDiscovery(state);
        let fullFilePath = path.join(currentGameInfo.modPath, fileName);

        fs.readFileAsync(fullFilePath)
        .then((readBytes) => callback(null, readBytes))
        .catch(() => callback(null, null));
      }

    public getExistingDataFileList =
      (folderPath: string, callback: (err, res: string[] ) => void) => {
        log('info', 'getExistingDataFileList called', util.inspect(folderPath));
        let state = this.api.store.getState();
        let currentGameInfo = currentGameDiscovery(state);
        let fullFilePath = path.join(currentGameInfo.modPath, folderPath);

        fs.readdirAsync(fullFilePath)
        .then((fileList) => callback(null, fileList))
        .catch(() => callback(null, null));
      }
}

export default Context;
