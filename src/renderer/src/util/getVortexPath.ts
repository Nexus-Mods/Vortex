import type { VortexPathBase, QualifiedPath } from "@vortex/shared/filesystem";
import type { VortexPaths } from "@vortex/shared/ipc";

import { ApplicationData } from "../applicationData";
import { VortexPathProvider } from "./vortexPathProvider";

export type AppPath = keyof VortexPaths;

function getVortexPath(id: AppPath): string {
  const vortexPaths = ApplicationData.instance.paths;
  return vortexPaths[id];
}

export function getVortexQualifiedPath(base: VortexPathBase): Promise<QualifiedPath> {
  return VortexPathProvider.instance.fromBase(base);
}

export default getVortexPath;
