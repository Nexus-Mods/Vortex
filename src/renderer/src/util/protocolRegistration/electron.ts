import { getPreloadApi } from "../preloadAccess";

// Electron-backed protocol registration helpers.

/**
 * Register Vortex as the default handler for a protocol via Electron.
 */
export function setDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): Promise<void> {
  return getPreloadApi().app.setProtocolClient(protocol, userDataPath ?? "");
}

/**
 * Check whether Vortex is currently the default handler for a protocol.
 */
export function isDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): Promise<boolean> {
  return getPreloadApi().app.isProtocolClient(protocol, userDataPath ?? "");
}

/**
 * Remove Vortex as the default handler for a protocol via Electron.
 */
export function removeDefaultProtocolClient(
  protocol: string,
  userDataPath?: string,
): Promise<void> {
  return getPreloadApi().app.removeProtocolClient(protocol, userDataPath ?? "");
}
