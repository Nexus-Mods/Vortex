import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {currentGameDiscovery} from '../../../util/selectors';

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

  public getAppVersion = (): string => {
    log('info', 'getAppVersion called', '');
    return app.getVersion();
  }

  public getCurrentGameVersion = (): string => {
    log('info', 'getCurrentGameVersion called', '');
    let state = this.api.store.getState();
    let currentGameInfo = currentGameDiscovery(state);
    let currentGameRelativeExecutablePath =
      state.session.gameMode.known[state.settings.gameMode.current].executable;
    let currentGameExecutablePath =
      path.join(currentGameInfo.path, currentGameRelativeExecutablePath);
    return getVersion(currentGameExecutablePath);
  }

  public checkIfFileExists = (fileName: string): boolean => {
    log('info', 'checkIfFileExists called', util.inspect(fileName));
    let state = this.api.store.getState();
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
