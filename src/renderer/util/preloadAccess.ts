/**
 * Helper module for accessing preload API with proper typing.
 * Use this in files that need to access window.api or application data
 * to ensure TypeScript recognizes these properties.
 *
 * NOTE: For windowId, appName, appVersion, and vortexPaths, you must ensure
 * ApplicationData.init() has been called before accessing these values.
 */

import type { Api, PreloadWindow } from "@vortex/shared/preload";

import { ApplicationData } from "@vortex/shared";

/**
 * Get the entire preload window object.
 * This is only available in the renderer process.
 * @deprecated Use window directly
 */
export function getPreloadWindow(): PreloadWindow {
  return window;
}

/**
 * Get the preload API from the window object.
 * This is only available in the renderer process.
 * @deprecated Use window.api directly
 */
export function getPreloadApi(): Api {
  return getPreloadWindow().api;
}

/**
 * Get the current window ID from the ApplicationData cache.
 * This is only available in the renderer process after ApplicationData.init() has been called.
 * @throws Error if ApplicationData has not been initialized
 */
export function getWindowId(): number {
  const windowId = ApplicationData.windowId;
  if (windowId === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return windowId;
}

/**
 * Get the app name from the ApplicationData cache.
 * This is only available in the renderer process after ApplicationData.init() has been called.
 * @throws Error if ApplicationData has not been initialized
 */
export function getAppName(): string {
  const name = ApplicationData.name;
  if (name === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return name;
}

/**
 * Get the app version from the ApplicationData cache.
 * This is only available in the renderer process after ApplicationData.init() has been called.
 * @throws Error if ApplicationData has not been initialized
 */
export function getAppVersion(): string {
  const version = ApplicationData.version;
  if (version === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return version;
}
