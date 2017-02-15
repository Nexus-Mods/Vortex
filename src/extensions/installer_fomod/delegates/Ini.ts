import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

import DelegateBase from './DelegateBase';

class Ini extends DelegateBase {
  constructor(api: IExtensionApi) {
    super(api);
  }

  public GetIniString = (dummy: any, callback: (err, res: string) => void) => {
    log('info', 'GetIniString called', '');
    callback(null, '');
  }

  public GetIniInt = (dummy: any, callback: (err, res: number) => void) => {
    log('info', 'GetIniString called', '');
    callback(null, 0);
  }
}

export default Ini;
