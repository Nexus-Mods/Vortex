import {IExtensionApi} from '../../../types/IExtensionContext';

class DelegateBase {
  private mApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public detach(): void {
    // nop
  }

  get api(): IExtensionApi {
    return this.mApi;
  }
}

export default DelegateBase;
