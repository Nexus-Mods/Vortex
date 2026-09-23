import type { IState } from "../types/IState";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const ZOOM_STEP = 0.1;
export const ZOOM_SHORTCUT_EVENT = "vortex-zoom-shortcut";

export function normalizeZoom(factor: number): number {
  return Number.isFinite(factor)
    ? Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, factor)) * 10) / 10
    : 1;
}

export const zoomFromState = (state: IState): number =>
  normalizeZoom(state.settings.window.zoomFactor ?? 1);
