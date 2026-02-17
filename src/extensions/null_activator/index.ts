import PromiseBB from "bluebird";
import type {
  IDeploymentMethod,
  IExtensionContext,
} from "../../renderer/types/IExtensionContext";
import type { IGame } from "../../renderer/types/IGame";
import { getGame } from "../gamemode_management/util/getGame";

class DeploymentMethod implements IDeploymentMethod {
  public id: string = "null-deployment";
  public name: string = "Null Deployment";
  public description: string =
    "Dummy deployment for games that can use mods directly from staging folder";
  public isFallbackPurgeSafe: boolean = true;
  public priority: number = 3;
  public noRedundancy: boolean = true;

  constructor() {
    // nop
  }

  public detailedDescription(t) {
    return t(
      "This deployment method does nothing during deployment (although extensions may still " +
        "do work during deployment). Only use for games that can be made to use mods " +
        "directly from staging.",
    );
  }
  public isSupported(state, gameId, modTypeId) {
    const game: IGame = getGame(gameId);
    return game.compatible?.nulldeployment === true
      ? undefined
      : {
          description: (t) =>
            t(
              "Only supported for games that can use mods directly from the staging folder",
            ),
          order: 1000,
        };
  }

  public userGate() {
    return PromiseBB.resolve();
  }

  public prepare(dataPath, clean, lastActivation, normalize) {
    return PromiseBB.resolve();
  }

  public finalize(gameId, dataPath, installationPath, progressCB) {
    return PromiseBB.resolve([]);
  }

  public activate(sourcePath, sourceName, dataPath, blackList) {
    return PromiseBB.resolve();
  }

  public deactivate(sourcePath, dataPath, sourceName) {
    return PromiseBB.resolve();
  }

  public prePurge(installPath) {
    return PromiseBB.resolve();
  }

  public purge(installPath, dataPtah, gameId) {
    return PromiseBB.resolve();
  }

  public postPurge() {
    return PromiseBB.resolve();
  }

  public externalChanges(gameId, installPath, dataPath, activation) {
    return PromiseBB.resolve([]);
  }

  public getDeployedPath(input) {
    return input;
  }

  public isDeployed(installPath, dataPath, file) {
    return PromiseBB.resolve(true);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDeploymentMethod(new DeploymentMethod());

  return true;
}

export default init;
