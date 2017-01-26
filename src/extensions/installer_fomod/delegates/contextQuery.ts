import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

export class Context {
  private mElectron = require('electron');
  private mExtensionApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mExtensionApi = api;
  }

  public getAppVersion = (): string => {
    log('info', 'getAppVersion called', '');
    let app = this.mElectron.app || this.mElectron.remote.app;
    return app.getVersion();
  }

  public getCurrentGameVersion = (): string => {
    log('info', 'getCurrentGameVersion called', '');
    return undefined;
  }

  public checkIfFileExists = (): boolean => {
    log('info', 'checkIfFileExists called', '');
    return false;
  }
}

export default Context;
