import type { VortexPaths } from "@vortex/shared/ipc";

import { ApplicationData } from "../applicationData";

export type AppPath = keyof VortexPaths;

function getVortexPath(id: AppPath): string {
  const vortexPaths = ApplicationData.instance.paths;
  return vortexPaths[id];
}

export default getVortexPath;
