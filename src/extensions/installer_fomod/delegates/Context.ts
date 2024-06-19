import {IExtensionApi} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';
import { getApplication } from '../../../util/application';
import {ProcessCanceled} from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';
import {isNullOrWhitespace} from '../../../util/util';

import {IDiscoveryResult} from '../../gamemode_management/types/IDiscoveryResult';
import {getGame} from '../../gamemode_management/util/getGame';

import DelegateBase from './DelegateBase';

import Promise from 'bluebird';
import minimatch from 'minimatch';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as util from 'util';

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
    starfield: 'sfse',
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
        return callback(null, getApplication().version);
      }

  public getCurrentGameVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('debug', 'getCurrentGameVersion called');
        this.gameInfo.getInstalledVersion(this.gameDiscovery)
          .then(version => {
            // the fomod installer does not support release tags
            callback(null, version.split(/\-+/)[0]);
          })
          .catch(err => {
            callback(err, null);
          });
      }

  public getExtenderVersion =
      (extender: string, callback: (err, res: string) => void) => {
        log('debug', 'getExtenderVersion called');
        this.gameInfo.getInstalledVersion(this.gameDiscovery)
          .then(version => {
            // the fomod installer does not support release tags
            callback(null, version.split(/\-+/)[0]);
          })
          .catch(err => {
            callback(err, null);
          });
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
    (basePath: string, pattern: string, recursive: boolean,
     callback: (err, res: string[]) => void) => {
      log('debug', 'getExistingDataFileList called', util.inspect(basePath));
      const fullPath = this.resolveFilePath(basePath);

      const filterFunc = isNullOrWhitespace(pattern)
        ? () => true
        : (input: IEntry) => minimatch(path.basename(input.filePath), pattern);

      this.readDir(fullPath, recursive, filterFunc)
        .then((fileList) => callback(null, fileList))
        .catch(err => callback(err, null));
  }

  private resolveFilePath(filePath: string): string {
    let modPath = this.gameInfo.queryModPath(this.gameDiscovery.path);
    if (!path.isAbsolute(modPath)) {
      modPath = path.join(this.gameDiscovery.path, modPath);
    }
    return path.join(modPath, filePath);
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
