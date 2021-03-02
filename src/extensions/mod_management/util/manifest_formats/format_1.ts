import { IDeploymentManifest } from '../../types/IDeploymentManifest';

function deserialize(input: any): IDeploymentManifest {
  return {
    version: 1,
    instance: input.instance,
    files: input.files,
    gameId: input.gameId,
    deploymentMethod: input.deploymentMethod,
    deploymentTime: input.deploymentTime,
    stagingPath: input.stagingPath,
    targetPath: input.targetPath,
  };
}

export default deserialize;
