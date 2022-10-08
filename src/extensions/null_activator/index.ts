import Bluebird from 'bluebird';
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
    return Bluebird.resolve();
  }

  public prepare(dataPath, clean, lastActivation, normalize) {
    return Bluebird.resolve();
  }

  public finalize(gameId, dataPath, installationPath, progressCB) {
    return Bluebird.resolve([]);
  }

  public activate(sourcePath, sourceName, dataPath, blackList) {
    return Bluebird.resolve();
  }

  public deactivate(sourcePath, dataPath, sourceName) {
    return Bluebird.resolve();
  }

  public prePurge(installPath) {
    return Bluebird.resolve();
  }

  public purge(installPath, dataPtah, gameId) {
    return Bluebird.resolve();
  }

  public postPurge() {
    return Bluebird.resolve();
  }

  public externalChanges(gameId, installPath, dataPath, activation) {
    return Bluebird.resolve([]);
  }

  public getDeployedPath(input) {
    return input;
  }

  public isDeployed(installPath, dataPath, file) {
    return Bluebird.resolve(true);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDeploymentMethod(new DeploymentMethod());

  return true;
}

export default init;
