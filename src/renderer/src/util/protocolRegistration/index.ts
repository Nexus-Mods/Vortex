/**
 * Protocol registration facade used by ExtensionManager.
 *
 * This module handles protocol registration on Windows and macOS using the
 * built-in Electron protocol APIs.
 *
 * (Note:sewer)
 * Electron does not provide generic registration for Linux because on Linux
 * this is normally handled by the package manager. However, in our case, we'll
 * need it in the future, for dynamic registration of tools/plugins etc; as
 * well as seamless switching between development and flatpak builds.
 *
 * More details in the Linux-specific submodule in `linux/index.ts`.
 */
import {
  isDefaultProtocolClient,
  removeDefaultProtocolClient,
  setDefaultProtocolClient,
} from "./electron";
import {
  deregisterLinuxProtocolHandler,
  registerLinuxProtocolHandler,
} from "./linux";
import type { IProtocolRegistrationOptions } from "./types";

export type { IProtocolRegistrationOptions } from "./types";

/**
 * Register protocol handling for the current platform.
 *
 * Returns `true` when Vortex was not already the default handler and registration
 * was required; returns `false` when no default-handler change was needed.
 */
export async function registerProtocolHandler(
  options: IProtocolRegistrationOptions,
): Promise<boolean> {
  if (process.platform === "linux") {
    return registerLinuxProtocolHandler(options);
  }

  const haveToRegister =
    options.setAsDefault &&
    !(await isDefaultProtocolClient(options.protocol, options.userDataPath));

  if (options.setAsDefault) {
    await setDefaultProtocolClient(options.protocol, options.userDataPath);
  }

  return haveToRegister;
}

/**
 * Remove protocol handling for the current platform route.
 */
export async function deregisterProtocolHandler(
  protocol: string,
  userDataPath?: string,
): Promise<void> {
  if (process.platform === "linux") {
    deregisterLinuxProtocolHandler(protocol);
    return;
  }

  await removeDefaultProtocolClient(protocol, userDataPath);
}
