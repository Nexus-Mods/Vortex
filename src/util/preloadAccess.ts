/**
 * Helper module for accessing preload API with proper typing.
 * Use this in files that need to access window.api or window.windowId
 * to ensure TypeScript recognizes these properties.
 */

import type { Api, PreloadWindow } from "../shared/types/preload";

/**
 * Get the preload API from the window object.
 * This is only available in the renderer process.
 */
export function getPreloadApi(): Api {
  return (window as unknown as PreloadWindow).api;
}

/**
 * Get the current window ID from the window object.
 * This is only available in the renderer process.
 */
export function getWindowId(): number {
  return (window as unknown as PreloadWindow).windowId;
}

/**
 * Get the app name from the window object.
 * This is only available in the renderer process.
 */
export function getAppName(): string {
  return (window as unknown as PreloadWindow).appName;
}

/**
 * Get the app version from the window object.
 * This is only available in the renderer process.
 */
export function getAppVersion(): string {
  return (window as unknown as PreloadWindow).appVersion;
}
