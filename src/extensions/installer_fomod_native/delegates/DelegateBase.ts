import { IExtensionApi } from '../../../types/IExtensionContext';

/**
 * Base class for FOMOD installer delegates
 * Provides access to the Vortex extension API
 */
class DelegateBase {
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public detach(): void {
    // nop - can be overridden by subclasses
  }

  get api(): IExtensionApi {
    return this.mApi;
  }
}

export default DelegateBase;
