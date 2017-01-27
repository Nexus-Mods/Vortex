import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

import DelegateBase from './DelegateBase';

class Ini extends DelegateBase {
  constructor(api: IExtensionApi) {
    super(api);
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
