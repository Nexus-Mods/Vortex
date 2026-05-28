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
    // Electron expects `appPath` to be the directory containing
    // package.json (or an .asar). In dev mode `getVortexPath("package")`
    // resolves to .../src/main/out -- the build-output dir, which has no
    // package.json -- so passing it to electron fails with "unable to
    // find electron app at ...". Fall back to `getVortexPath("application")`
    // in dev (the dir containing package.json, which is what `pnpm start`
    // uses); production keeps "package" so the .asar path is used.
    appPath:
      process.env.NODE_ENV === "development"
        ? getVortexPath("application")
        : getVortexPath("package"),
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
