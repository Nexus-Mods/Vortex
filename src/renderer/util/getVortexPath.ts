import type { VortexPaths } from "@vortex/shared/ipc";

import { ApplicationData } from "../applicationData";
import { log } from "../logging";

type KnownKeys<T> = keyof {
  [K in keyof T as string extends K ? never : K]: T[K];
};

export type AppPath = KnownKeys<VortexPaths>;

export function setVortexPath(id: AppPath, value: string | (() => string)) {
  const strValue = typeof value === "string" ? value : value();
  window.api.app
    .setPath(id, strValue)
    .catch((err: unknown) => log("error", "error setting path", err));
}

function getVortexPath(id: AppPath): string {
  const vortexPaths = ApplicationData.instance.paths;
  return vortexPaths[id];
}

export default getVortexPath;
