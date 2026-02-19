/**
 * Shared application data initialization and access.
 * Used by both main process (to set data) and renderer process (to fetch/access data).
 * Replaces synchronous IPC calls that were previously in electron/remote
 *
 * In the future we can incorporate this into the util/application.ts singleton
 * but for now this keeps things simple and focused.
 */

import type { VortexPaths } from "./types/ipc";
import type { PreloadWindow } from "./types/preload";

// Cache for application data - shared between main and renderer
let cachedAppName: string | undefined;
let cachedAppVersion: string | undefined;
let cachedVortexPaths: VortexPaths | undefined;
let cachedWindowId: number | undefined;
let isInitialized = false;

/**
 * Application data initialization and access.
 * - Main process: call set() to populate the cache directly
 * - Renderer process: call init() to fetch values via async IPC
 */
export const ApplicationData = {
  /**
   * Set application data directly (main process only).
   * Call this early in main process startup before the renderer starts.
   */
  set(data: {
    appName: string;
    appVersion: string;
    vortexPaths: VortexPaths;
  }): void {
    cachedAppName = data.appName;
    cachedAppVersion = data.appVersion;
    cachedVortexPaths = data.vortexPaths;
    isInitialized = true;
  },

  /**
   * Initialize application data asynchronously (renderer process).
   * Fetches app name, version, window ID, and vortex paths via async IPC
   * from the main process cache.
   * Must be called early in renderer startup before these values are needed.
   */
  async init(): Promise<void> {
    if (isInitialized) {
      return;
    }

    // Access window directly with proper typing (avoids importing renderer-only code)
    // In browser/renderer, globalThis === window
    const preload = globalThis as unknown as PreloadWindow;
    const api = preload.api;

    // Fetch all values in parallel from the main process cache
    const [windowId, name, version, paths] = await Promise.all([
      api.window.getId(),
      api.app.getName(),
      api.app.getVersion(),
      api.app.getVortexPaths(),
    ]);

    cachedWindowId = windowId;
    cachedAppName = name;
    cachedAppVersion = version;
    cachedVortexPaths = paths;
    isInitialized = true;
  },

  /** Check if ApplicationData has been initialized */
  get isInitialized(): boolean {
    return isInitialized;
  },

  /** Get cached app name (after init/set) */
  get name(): string | undefined {
    return cachedAppName;
  },

  /** Get cached app version (after init/set) */
  get version(): string | undefined {
    return cachedAppVersion;
  },

  /** Get cached vortex paths (after init/set) */
  get vortexPaths(): VortexPaths | undefined {
    return cachedVortexPaths;
  },

  /** Get cached window ID (after init, renderer only) */
  get windowId(): number | undefined {
    return cachedWindowId;
  },
};
