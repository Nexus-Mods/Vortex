import { IDeploymentManifest } from '../../types/IDeploymentManifest';

function deserialize(input: any): IDeploymentManifest {
  return {
    version: 1,
    instance: input.instance,
    files: input.files,
  };
}

export default deserialize;
