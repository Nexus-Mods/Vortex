import type { PreloadWindow } from "../shared/types/preload";

declare global {
  interface Window extends PreloadWindow {
    readonly __preload: true;
  }
}
