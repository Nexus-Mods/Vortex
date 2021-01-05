import Promise from 'bluebird';
import { IDeploymentMethod, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { getGame } from '../gamemode_management/util/getGame';

class DeploymentMethod implements IDeploymentMethod {
  public id: string = 'null-deployment';
  public name: string = 'Null Deployment';
  public description: string = 'Dummy deployment for games that can use mods directly from staging folder';
  public isFallbackPurgeSafe: boolean = true;
  public priority: number = 3;
  public noRedundancy: boolean = true;

  constructor() {
    // nop
  }

  public detailedDescription(t) {
    return t('This deployment method does nothing during deployment (although extensions may still '
      + 'do work during deployment). Only use for games that can be made to use mods '
      + 'directly from staging.');
  }
  public isSupported(state, gameId, modTypeId) {
    const game: IGame = getGame(gameId);
    return (game.compatible?.nulldeployment === true)
      ? undefined
      : {
        description: t => t('Only supported for games that can use mods directly from the staging folder'),
        order: 1000,
      };
  }

  public userGate() {
    return Promise.resolve();
  }

  public prepare(dataPath, clean, lastActivation, normalize) {
    return Promise.resolve();
  }

  public finalize(gameId, dataPath, installationPath, progressCB) {
    return Promise.resolve([]);
  }

  public activate(sourcePath, sourceName, dataPath, blackList) {
    return Promise.resolve();
  }

  public deactivate(sourcePath, dataPath, sourceName) {
    return Promise.resolve();
  }

  public prePurge(installPath) {
    return Promise.resolve();
  }

  public purge(installPath, dataPtah, gameId) {
    return Promise.resolve();
  }

  public postPurge() {
    return Promise.resolve();
  }

  public externalChanges(gameId, installPath, dataPath, activation) {
    return Promise.resolve([]);
  }

  public getDeployedPath(input) {
    return input;
  }

  public isDeployed(installPath, dataPath, file) {
    return Promise.resolve(true);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDeploymentMethod(new DeploymentMethod());

  return true;
}

export default init;
