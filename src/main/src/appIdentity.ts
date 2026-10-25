import path from "node:path";

import { APP_NAME, APP_STATE_DIR, APP_STATE_DIR_DEVEL, isVortexDataPath } from "@vortex/shared";

/**
 * mkeiitmods keeps all of its data in its own folder so it can run next to an
 * installed copy of the original Vortex without touching that copy's state
 * (`%APPDATA%\Vortex`, `%ProgramData%\vortex`, ...).
 */

export interface IDataPathEnv {
  appData: string;
  programData?: string;
  development: boolean;
}

/**
 * Per-user data folder: Electron's own data (caches, logs, startup.json) and the
 * persistent application state. Development builds use a separate folder so
 * they can't damage the data of the installed app.
 */
export function dataRootPath(env: IDataPathEnv): string {
  return path.join(env.appData, env.development ? APP_STATE_DIR_DEVEL : APP_STATE_DIR);
}

/** Shared (multi-user) data folder, Windows only. */
export function multiUserRootPath(programData: string): string {
  return path.join(programData, APP_NAME);
}

/** Roots under which the original Vortex keeps its data folders. */
export function vortexDataRoots(env: IDataPathEnv): string[] {
  return env.programData !== undefined ? [env.appData, env.programData] : [env.appData];
}

export class VortexDataPathError extends Error {
  constructor(public readonly dataPath: string) {
    super(
      `Refusing to use "${dataPath}": this folder belongs to Vortex. ` +
        `${APP_NAME} keeps its data separately so it never changes your Vortex setup.`,
    );
    this.name = "VortexDataPathError";
  }
}

/** Throws if the path points into a folder owned by the original Vortex. */
export function assertNotVortexDataPath(dataPath: string, env: IDataPathEnv): void {
  if (isVortexDataPath(dataPath, vortexDataRoots(env))) {
    throw new VortexDataPathError(dataPath);
  }
}
