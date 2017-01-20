import {IExtensionContext} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

export class Ini {
  private mCurrentContext: IExtensionContext;

  constructor(context: IExtensionContext) {
    this.mCurrentContext = context;
  }

  public GetIniString (): string {
    log('info', 'GetIniString called', '');
    return undefined;
  }

  public GetIniInt (): number {
    log('info', 'GetIniString called', '');
    return 0;
  }
}

export default Ini;
