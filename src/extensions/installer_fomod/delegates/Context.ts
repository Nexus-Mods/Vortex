import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {activeGameId, currentGameDiscovery} from '../../../util/selectors';

import DelegateBase from './DelegateBase';

import { app as appIn, remote} from 'electron';
import getVersion from 'exe-version';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as util from 'util';

let app = appIn || remote.app;

export class Context extends DelegateBase {
  constructor(api: IExtensionApi) {
    super(api);
  }

  public getAppVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('info', 'getAppVersion called', '');
        return callback(null, app.getVersion());
      }

  public getCurrentGameVersion =
      (dummy: any, callback: (err, res: string) => void) => {
        log('info', 'getCurrentGameVersion called', '');
        let state = this.api.store.getState();
        let currentGameInfo = currentGameDiscovery(state);
        let currentGameRelativeExecutablePath =
            state.session.gameMode.known[activeGameId(state)].executable;
        let currentGameExecutablePath =
            path.join(currentGameInfo.path, currentGameRelativeExecutablePath);
        return callback(null, getVersion(currentGameExecutablePath));
      }

  public getExtenderVersion =
      (extender: string, callback: (err, res: string) => void) => {
        return callback(null, null);
      }

  public isExtenderPresent =
      (par: any, callback: (err, res: boolean) => void) => {
        log('info', 'isExtenderPresent called');
        return callback(null, false);
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
}

export default Context;
