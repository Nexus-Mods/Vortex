import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

export class Ini {
  private mExtensionApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mExtensionApi = api;
  }

  public GetIniString = (): string => {
    log('info', 'GetIniString called', '');
    return undefined;
  }

  public GetIniInt = (): number => {
    log('info', 'GetIniString called', '');
    return 0;
  }
}

export default Ini;
