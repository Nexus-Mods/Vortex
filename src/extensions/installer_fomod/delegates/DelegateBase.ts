import {IExtensionApi} from '../../../types/IExtensionContext';

class DelegateBase {
  private mApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  get api(): IExtensionApi {
    return this.mApi;
  }
}

export default DelegateBase;
