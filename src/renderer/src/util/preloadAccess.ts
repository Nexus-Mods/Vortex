import type { Api, PreloadWindow } from "@vortex/shared/preload";

import { ApplicationData } from "../applicationData";

/**
 * @deprecated Use window directly
 */
export function getPreloadWindow(): PreloadWindow {
  return window;
}

/**
 * @deprecated Use window.api directly
 */
export function getPreloadApi(): Api {
  return getPreloadWindow().api;
}

/**
 * @deprecated Use ApplicationData directly
 */
export function getWindowId(): number {
  const windowId = ApplicationData.instance.windowId;
  if (windowId === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return windowId;
}

/**
 * @deprecated Use ApplicationData directly
 */
export function getAppName(): string {
  const name = ApplicationData.instance.name;
  if (name === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return name;
}

/**
 * @deprecated Use ApplicationData directly
 */
export function getAppVersion(): string {
  const version = ApplicationData.instance.version;
  if (version === undefined) {
    throw new Error(
      "ApplicationData not initialized. Call ApplicationData.init() first.",
    );
  }
  return version;
}
