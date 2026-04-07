/**
 * Linux-specific protocol registration route map.
 *
 * On Linux, protocol associations are normally handled by the package manager.
 * This module provides a minimal custom route for `nxm://` to support development
 * workflows where package-managed registration is not available.
 *
 * For the full context on protocol registration across platforms, see:
 * @see {@link ../index.ts}
 *
 * This route is intentionally nxm-only and hardcoded. We will update this in the
 * future as we explore allowing generic tools/plugins to register themselves like
 * on Windows. [If that functionality is even used anywhere.]
 */
import * as path from "path";

import getVortexPath from "../../getVortexPath";
import { log } from "../../log";
import {
  deregisterLinuxNxmProtocolHandler,
  registerLinuxNxmProtocolHandler,
} from "./nxm";
import type { IProtocolRegistrationOptions } from "../types";

const NXM_PROTOCOL = "nxm";

/**
 * Register Linux protocol handling through the Linux-specific route map.
 *
 * At present only `nxm` has a custom Linux route; other protocols are not
 * supported and return `false` (registration fails silently).
 */
export function registerLinuxProtocolHandler(
  options: IProtocolRegistrationOptions,
): boolean {
  if (options.protocol !== NXM_PROTOCOL) {
    log(
      "warn",
      "linux protocol registration not supported for non-nxm:// protocols (only Vortex nxm:// is currently supported)",
      {
        protocol: options.protocol,
        supportedProtocol: NXM_PROTOCOL,
      },
    );
    return false;
  }

  return registerLinuxNxmProtocolHandler({
    setAsDefault: options.setAsDefault,
    executablePath: process.execPath,
    // getVortexPath("package") returns src/main/out in dev (Electron 37+ sets
    // getAppPath() to the out/ dir). That directory has no package.json, so a
    // second Electron instance launched from the wrapper uses app name "Electron"
    // and a different userData path, causing requestSingleInstanceLock() to
    // succeed (no conflict) and the second-instance event to never fire.
    // Using the parent directory ensures Electron finds package.json and uses
    // the same app name (@vortex/main) and lock file as the running instance.
    appPath: path.dirname(getVortexPath("package")),
  });
}

/**
 * Deregister Linux protocol handling through the Linux-specific route map.
 */
export function deregisterLinuxProtocolHandler(protocol: string): void {
  if (protocol !== NXM_PROTOCOL) {
    return;
  }

  deregisterLinuxNxmProtocolHandler();
}
