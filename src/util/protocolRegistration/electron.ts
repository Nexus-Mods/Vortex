import * as path from "path";

import getVortexPath from "../getVortexPath";
import { makeRemoteCallSync } from "../electronRemote";

// Electron-backed protocol registration helpers.

/**
 * Register Vortex as the default handler for a protocol via Electron.
 */
export function setDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): void {
  setSelfAsProtocolClient(protocol, userDataPath ?? "");
}

/**
 * Check whether Vortex is currently the default handler for a protocol.
 */
export function isDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): boolean {
  return isSelfProtocolClient(protocol, userDataPath ?? "");
}

/**
 * Remove Vortex as the default handler for a protocol via Electron.
 */
export function removeDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): void {
  removeSelfAsProtocolClient(protocol, userDataPath ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function selfCL(_userDataPath?: string): [string, string[]] {
  let execPath = process.execPath;
  // make it work when using the development version
  if (execPath.endsWith("electron.exe")) {
    execPath = path.join(getVortexPath("package"), "vortex.bat");
  }

  const args: string[] = [];
  /*
  TODO: This is necessary for downloads to multiple instances to work correctly but
    it doesn't work until https://github.com/electron/electron/issues/18397 is fixed

  if (_userDataPath !== undefined) {
    args.push('--user-data', _userDataPath);
  }
  */

  args.push("-d");

  return [execPath, args];
}

const setSelfAsProtocolClient = makeRemoteCallSync(
  "set-as-default-protocol-client",
  (electron, contents, protocol: string, udPath: string) => {
    const [execPath, args] = selfCL(udPath);
    electron.app.setAsDefaultProtocolClient(protocol, execPath, args);
  },
);

const isSelfProtocolClient = makeRemoteCallSync(
  "is-self-protocol-client",
  (electron, contents, protocol: string, udPath: string) => {
    const [execPath, args] = selfCL(udPath);
    return electron.app.isDefaultProtocolClient(protocol, execPath, args);
  },
);

const removeSelfAsProtocolClient = makeRemoteCallSync(
  "remove-as-default-protocol-client",
  (electron, contents, protocol: string, udPath: string) => {
    const [execPath, args] = selfCL(udPath);
    electron.app.removeAsDefaultProtocolClient(protocol, execPath, args);
  },
);
