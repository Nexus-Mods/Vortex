import type { PreloadWindow } from "@vortex/shared/preload";

declare global {
  interface Window extends PreloadWindow {
    readonly __preload: true;
  }
}

export {};
