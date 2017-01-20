import {IExtensionContext} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

export class Context {
  private mCurrentContext: IExtensionContext;

  constructor(context: IExtensionContext) {
    this.mCurrentContext = context;
  }

  public GetAppVersion (): string {
    log('info', 'GetAppVersion called', '');
    return undefined;
  }

  public GetCurrentGameVersion (): string {
    log('info', 'GetCurrentGameVersion called', '');
    return undefined;
  }

  public CheckIfFileExists (): boolean {
    log('info', 'CheckIfFileExists called', '');
    return false;
  }
}

export default Context;