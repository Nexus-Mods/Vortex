import {IExtensionApi} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';
import {ProcessCanceled} from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';
import {isNullOrWhitespace} from '../../../util/util';

import {IDiscoveryResult} from '../../gamemode_management/types/IDiscoveryResult';
import {getGame} from '../../gamemode_management/util/getGame';

import DelegateBase from './DelegateBase';

import Promise from 'bluebird';
import { app as appIn, remote} from 'electron';
import getVersion from 'exe-version';
import * as path from 'path';
import turbowalk from 'turbowalk';
import * as util from 'util';

const app = appIn || remote.app;

function extenderForGame(gameId: string) {
  return {
    morrowind: 'mwse',
    oblivion: 'obse',
    skyrim: 'skse',
    skyrimse: 'skse64',
    skyrimvr: 'skse64',
    fallout3: 'fose',
    falloutnv: 'nvse',
    fallout4: 'f4se',
    fallout4vr: 'f4se',
  }[gameId];
}

export class Context extends DelegateBase {
  private gameId: string;
  private gameDiscovery: IDiscoveryResult;
  private gameInfo: IGame;
  constructor(api: IExtensionApi, gameId: string) {
    super(api);
    this.gameId = gameId;

    this.gameDiscovery =
        getSafe(api.store.getState(),
                ['settings', 'gameMode', 'discovered', gameId], undefined);
    this.gameInfo = getGame(this.gameId);
    if ((this.gameDiscovery === undefined) || (this.gameDiscovery.path === undefined)) {
      throw new ProcessCanceled('Game not installed');
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
        const executable = this.gameDiscovery.executable || this.gameInfo.executable();
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

        const fullPath = this.resolveFilePath(fileName);
        fs.statAsync(fullPath)
          .then(() => callback(null, true))
          .catch(() => callback(null, false));
      }

  public getExistingDataFile =
      (fileName: string, callback: (err, res: any) => void) => {
        log('debug', 'getExistingDataFile called', util.inspect(fileName));
        const fullPath = this.resolveFilePath(fileName);

        fs.readFileAsync(fullPath)
          .then(data => callback(null, data))
          .catch(err => callback(err, null));
      }

  public getExistingDataFileList =
    (searchOptions: any[], callback: (err, res: string[]) => void) => {
      log('debug', 'getExistingDataFileList called', util.inspect(searchOptions[0]));
      const fullPath = this.resolveFilePath(searchOptions[0]);

      if (searchOptions[2] === true) {
        this.readDirRecursive(fullPath, searchOptions[1])
          .then((fileList) => callback(null, fileList))
          .catch(err => callback(err, null));
      } else {
        fs.readdirAsync(fullPath)
          .then(fileList => callback(null, fileList.map(iter => path.join(fullPath, iter))))
          .catch(err => callback(err, null));
      }
  }

  private resolveFilePath(filePath: string): string {
    let modPath = this.gameInfo.queryModPath(this.gameDiscovery.path);
    if (!path.isAbsolute(modPath)) {
      modPath = path.join(this.gameDiscovery.path, modPath);
    }
    return path.join(modPath, filePath);
  }

  private readDirRecursive = (rootPath: string,
                              filter: string): Promise<string[]> => {
    let fileList: string[] = [];

    const filterFunc = isNullOrWhitespace(filter)
      ? () => true
      : input => path.basename(input).indexOf(filter) !== -1;

    return turbowalk(rootPath, entries => {
      fileList = fileList.concat(
        entries
          .filter(iter => !iter.isDirectory)
          .filter(filterFunc)
          .map(iter => path.relative(rootPath, iter.filePath)));
    })
    .then(() => fileList);
  }
}

export default Context;
