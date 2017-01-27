import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {currentGameDiscovery} from '../../../util/storeHelper';

import getVersion from 'exe-version';
import fs = require('fs-extra-promise');
import path = require('path');
import * as util from 'util';

export class Context {
  private electron = require('electron');
  private mExtensionApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mExtensionApi = api;
  }

  public getAppVersion = (): string => {
    log('info', 'getAppVersion called', '');
    let app = this.electron.app || this.electron.remote.app;
    return app.getVersion();
  }

  public getCurrentGameVersion = (): string => {
    log('info', 'getCurrentGameVersion called', '');
    let state = this.mExtensionApi.store.getState();
    let currentGameInfo = currentGameDiscovery(state);
    let currentGameRelativeExecutablePath =
      state.session.gameMode.known[state.settings.gameMode.current].executable;
    let currentGameExecutablePath =
      path.join(currentGameInfo.path, currentGameRelativeExecutablePath);
    return getVersion(currentGameExecutablePath);
  }

  public checkIfFileExists = (fileName: string): boolean => {
    log('info', 'checkIfFileExists called', util.inspect(fileName));
    let state = this.mExtensionApi.store.getState();
    let currentGameInfo = currentGameDiscovery(state);
    let fullFilePath = path.join(currentGameInfo.modPath, fileName);
    let isPresent = false;

    fs.statAsync(fullFilePath).reflect()
            .then((stat) => {
            if (stat.isFulfilled()) {
                isPresent = true;
            }
        });
    return isPresent;
  }
}

export default Context;
