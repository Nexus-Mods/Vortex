import { webFrame } from "electron";
import type { Store } from "redux";

import { setZoomFactor } from "../actions/window";
import type { IState } from "../types/IState";
import { normalizeZoom, zoomFromState, ZOOM_SHORTCUT_EVENT, ZOOM_STEP } from "./zoom";

export function requestZoom(store: Store<IState>, factor: number, target: Window = window): void {
  store.dispatch(setZoomFactor(normalizeZoom(factor)));
  target.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT));
}

export function initializeZoom(store: Store<IState>, target: Window = window): () => void {
  const isModern = () => store.getState().settings.window.useModernLayout;
  const root = target.document.documentElement;
  const applyModernZoom = (factor: number) => {
    root.style.setProperty("--app-zoom", String(factor));
    root.style.zoom = String(factor);
  };
  let applied: number | undefined = isModern() ? zoomFromState(store.getState()) : undefined;
  // Native page zoom round-trips through Chromium and can replay an older factor
  // after React has rendered. CSS zoom and its chrome compensation update together.
  webFrame.setZoomFactor(isModern() ? 1 : (store.getState().settings.window.zoomFactor ?? 1));
  if (applied !== undefined) applyModernZoom(applied);
  const unsubscribe = store.subscribe(() => {
    if (!isModern()) {
      if (applied !== undefined) {
        root.style.removeProperty("zoom");
        root.style.removeProperty("--app-zoom");
        webFrame.setZoomFactor(store.getState().settings.window.zoomFactor ?? 1);
      }
      applied = undefined;
      return;
    }
    const factor = zoomFromState(store.getState());
    if (applied === undefined) webFrame.setZoomFactor(1);
    if (factor !== applied) {
      applied = factor;
      applyModernZoom(factor);
    }
  });
  const onWheel = (event: WheelEvent) => {
    if (!isModern() || !event.ctrlKey || event.deltaY === 0) return;
    // Cancel Chromium's own zoom and page scrolling, including at the limits.
    event.preventDefault();
    requestZoom(
      store,
      zoomFromState(store.getState()) - Math.sign(event.deltaY) * ZOOM_STEP,
      target,
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isModern()) return;
    if (!(event.ctrlKey || (process.platform === "darwin" && event.metaKey)) || event.altKey)
      return;
    const direction = event.key === "+" || event.key === "=" ? 1 : event.key === "-" ? -1 : 0;
    if (direction === 0 && event.key !== "0") return;
    event.preventDefault();
    requestZoom(
      store,
      direction === 0 ? 1 : zoomFromState(store.getState()) + direction * ZOOM_STEP,
      target,
    );
  };
  target.addEventListener("wheel", onWheel, { passive: false, capture: true });
  target.addEventListener("keydown", onKeyDown);
  return () => {
    unsubscribe();
    target.removeEventListener("wheel", onWheel, { capture: true });
    target.removeEventListener("keydown", onKeyDown);
    root.style.removeProperty("zoom");
    root.style.removeProperty("--app-zoom");
  };
}
