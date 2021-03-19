import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';

import { ProcessCanceled } from '../../../util/CustomErrors';
import { log } from '../../../util/log';
import { currentGame } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import getVortexPath from '../../../util/getVortexPath';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { getGame } from '../../gamemode_management/util/getGame';

import DelegateBase from './DelegateBase';

import Promise from 'bluebird';
import { app as appIn, remote} from 'electron';
import getVersion from 'exe-version';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';

import { IPatcherDetails } from '../types/injector';

const app = appIn || remote.app;

export class Context extends DelegateBase {
  private mGameId: string;
  private mGameDiscovery: IDiscoveryResult;
  private mGameInfo: IGame;
  private mModLoaderPath: string;
  private mVMLdependenciesPath: string;
  private mPatcherDetails: IPatcherDetails;

  constructor(api: IExtensionApi, gameId: string, modLoaderPath: string) {
    super(api);
    this.mGameId = gameId;

    this.mModLoaderPath = modLoaderPath;
    this.mVMLdependenciesPath = path.join(getVortexPath('modules_unpacked'), 'harmony-patcher', 'dist');

    this.mGameDiscovery =
        getSafe(api.store.getState(),
                ['settings', 'gameMode', 'discovered', gameId], undefined);
    this.mGameInfo = getGame(this.mGameId);
    if (this.mGameDiscovery?.path === undefined) {
      const error = new ProcessCanceled('Game not installed');
      (error as any)['attachLogOnReport'] = true;
      (error as any)['gameMode'] = gameId;
      throw error;
    }

    this.mPatcherDetails = this.mGameInfo?.details?.harmonyPatchDetails;
  }

  public getAppVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', '[Harmony-Injector] getAppVersion called');
        return callback(null, app.getVersion());
      }

  public getCurrentGameVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', 'getCurrentGameVersion called');
        const executable = this.mGameDiscovery.executable || this.mGameInfo.executable();
        const gameExePath =
            path.join(this.mGameDiscovery.path, executable);
        return callback(null, getVersion(gameExePath));
      }

  public getDatapath =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', 'getDatapath called');
        const discoveryPath = this.mGameDiscovery.path;
        let dataPath = this.mPatcherDetails !== undefined
          ? this.mPatcherDetails.dataPath
          : discoveryPath;
        dataPath = (path.isAbsolute(dataPath))
          ? dataPath
          : path.join(discoveryPath, dataPath);
        return callback(null, dataPath);
      }

  public getModsPath =
    (dummy: any, callback: (err, res: string) => void) => {
      log('debug', 'getModsPath called');
      const discoveryPath = this.mGameDiscovery.path;
      let modsPath = this.mPatcherDetails !== undefined
        ? this.mPatcherDetails.modsPath
        : discoveryPath;

      modsPath = path.isAbsolute(modsPath)
        ? modsPath
        : path.join(discoveryPath, modsPath);
      return callback(null, modsPath);
    }

  public getModLoaderPath =
    (dummy: any, callback: (err, res: string) => void) => {
      log('debug', 'getModLoaderPath called');
      const discoveryPath = this.mGameDiscovery.path;
      let dataPath = this.mPatcherDetails !== undefined
        ? this.mPatcherDetails.dataPath
        : discoveryPath;
      dataPath = (path.isAbsolute(dataPath))
        ? dataPath
        : path.join(discoveryPath, dataPath);
      const loaderPath = (this.mModLoaderPath !== undefined) && (this.mModLoaderPath !== dataPath)
        ? this.mModLoaderPath : dataPath;
      return callback(null, loaderPath);
    }

  public getVMLDepsPath =
    (dummy: any, callback: (err, res: string) => void) => {
      log('debug', 'getVMLDepsPath called');
      return callback(null, this.mVMLdependenciesPath);
    }

  public getExtensionPath =
    (dummy: any, callback: (err, res: string) => void) => {
      log('debug', 'getExtensionPath called');
      const extensionPath: string = (this.mGameInfo?.extensionPath !== undefined)
        ? this.mGameInfo.extensionPath
        : this.getStoredGameInfo()?.extensionPath;

      return (extensionPath !== undefined)
        ? callback(null, extensionPath)
        : callback('Failed to resolve extensionPath', null);
    }

  public getDeploymentRequired =
    (dummy: any, callback: (err, res: string) => void) => {
      // Used by the injector to ascertain whether
      //  it needs to manage the deployment on its own,
      //  or whether the harmony modtype is doing it.
      log('debug', 'getDeploymentRequired called');
      return (this.mPatcherDetails !== undefined)
        ? callback(null, 'False')
        : callback(null, 'True');
    }

  private getStoredGameInfo(): IGameStored {
    const state: any = this.api.store.getState();
    if (state === undefined) {
      return undefined;
    }

    const game: IGameStored = currentGame(state);
    if (game === undefined) {
      return undefined;
    }

    return game;
  }

  private readDir = (rootPath: string,
                     recurse: boolean,
                     filterFunc: (entry: IEntry) => boolean)
                     : Promise<string[]> => {
    let fileList: string[] = [];

    return turbowalk(rootPath, entries => {
      fileList = fileList.concat(
        entries
          .filter(iter => !iter.isDirectory)
          .filter(filterFunc)
          // in the past this mapped to a path relative to rootPath but NMM
          // clearly returns absolute paths. Obviously there is no documentation
          // for the _expected_ behavior
          .map(iter => iter.filePath));
    }, { recurse })
    .then(() => fileList);
  }
}

export default Context;
