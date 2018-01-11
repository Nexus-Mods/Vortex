import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as usvfs from 'usvfs';
import { types, util } from 'vortex-api';

class USVFSDeploymentMethod implements types.IDeploymentMethod {
  public id: string = 'usvfs-deployment';
  public name: string = 'USVFS Deployment';
  public description: string = 'Deployment happens only in memory and affects only '
                             + 'applications started from Vortex';

  private mAPI: types.IExtensionApi;

  constructor(api: types.IExtensionApi) {
    this.mAPI = api;
  }

  public detailedDescription(t: I18next.TranslationFunction): string {
    return t(this.description);
  }

  public isSupported(state: any, gameId: string, modTypeId: string): string {
    return undefined;
  }

  public userGate(): Promise<void> {
    return Promise.resolve();
  }

  public prepare(dataPath: string,
                 clean: boolean,
                 lastActivation: types.IDeployedFile[]): Promise<void> {
    if (clean) {
      usvfs.clearMappings();
    }
    return Promise.resolve();
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void):
      Promise<types.IDeployedFile[]> {
    return Promise.resolve([]);
  }

  public activate(sourcePath: string, sourceName: string, dataPath: string,
                  blackList: Set<string>): Promise<void> {
    usvfs.linkDirectory(sourcePath, dataPath, { recursive: true });
    return Promise.resolve();
  }

  public deactivate(installPath: string, dataPath: string, mod: types.IMod): Promise<void> {
    return Promise.resolve();
  }
  public purge(installPath: string, dataPath: string): Promise<void> {
    usvfs.clearMappings();
    return Promise.resolve();
  }

  public externalChanges(gameId: string, installPath: string, dataPath: string,
                         activation: types.IDeployedFile[]):
      Promise<types.IFileChange[]> {
    return Promise.resolve([]);
  }

  public isActive(): boolean {
    return false;
  }
}

function init(context: types.IExtensionContext) {
  context.registerDeploymentMethod(new USVFSDeploymentMethod(context.api));

  return true;
}

export default init;
