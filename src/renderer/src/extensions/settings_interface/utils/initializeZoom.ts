import { webFrame } from "electron";
import type { Store } from "redux";

import { setZoomFactor } from "@/actions/window";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { normalizeZoom, zoomFromState, ZOOM_SHORTCUT_EVENT, ZOOM_STEP } from "./zoom";

type ZoomEvents = IExtensionApi["events"];

/** Wheel travel per zoom step: one notch of an ordinary mouse wheel. */
const WHEEL_STEP_DELTA = 100;
/**
 * Slack when comparing scaled travel with a notch. Chromium hands deltaY over as
 * a float32, so 100 / zoom scaled back by the zoom lands just under 100
 * (-83.33333 x 1.2 = -99.999996) and would otherwise miss the step.
 */
const WHEEL_STEP_TOLERANCE = 0.5;
/** A pause this long ends a wheel or pinch gesture, dropping any partial step. */
const WHEEL_GESTURE_GAP_MS = 300;

/** Chromium stores zoom as a level, so a factor can come back with rounding error. */
const differs = (a: number, b: number) => Math.abs(a - b) > 0.001;

export function requestZoom(
  store: Store<IState>,
  factor: number,
  target: Window = window,
  events?: ZoomEvents,
): void {
  const normalized = normalizeZoom(factor);
  store.dispatch(setZoomFactor(normalized));
  target.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT));
  events?.emit("analytics-track-zoom-changed", Math.round(normalized * 100));
}

/**
 * Applies the saved zoom with Electron's page zoom in both layouts, so pointer
 * coordinates and positioned elements stay in one coordinate space. Nothing in
 * the chrome is exempted — the title bar and spine zoom with everything else.
 */
export function initializeZoom(
  store: Store<IState>,
  target: Window = window,
  events?: ZoomEvents,
): () => void {
  const isModern = () => store.getState().settings.window.useModernLayout;
  // Legacy trusts whatever factor is already stored rather than re-deriving it on
  // read; a write from the shared hotkey/wheel handlers below normalises either way.
  const desiredZoom = () =>
    isModern()
      ? zoomFromState(store.getState())
      : (store.getState().settings.window.zoomFactor ?? 1);

  let lastDesired: number | undefined;
  let lastModern: boolean | undefined;
  const apply = () => {
    const factor = desiredZoom();
    if (factor === lastDesired && isModern() === lastModern) return;
    lastDesired = factor;
    lastModern = isModern();
    if (differs(webFrame.getZoomFactor(), factor)) webFrame.setZoomFactor(factor);
  };

  // Chromium can change the frame's zoom behind the store, such as restoring the
  // level it keeps per origin.
  const onResize = () => {
    if (differs(webFrame.getZoomFactor(), desiredZoom())) webFrame.setZoomFactor(desiredZoom());
  };

  apply();
  const unsubscribe = store.subscribe(apply);
  const onWheel = makeWheelHandler(store, target, events);
  const onKeyDown = makeKeyHandler(store, target, events);
  target.addEventListener("resize", onResize);
  target.addEventListener("wheel", onWheel, { passive: false, capture: true });
  target.addEventListener("keydown", onKeyDown);
  return () => {
    unsubscribe();
    target.removeEventListener("resize", onResize);
    target.removeEventListener("wheel", onWheel, { capture: true });
    target.removeEventListener("keydown", onKeyDown);
  };
}

/**
 * Ctrl+wheel moves one step per notch's worth of travel, whatever the event count.
 * A touchpad pinch or high-resolution wheel sends many small deltas for one
 * gesture, and stepping on each would jump straight to a limit. Works in both
 * layouts.
 */
function makeWheelHandler(store: Store<IState>, target: Window, events?: ZoomEvents) {
  let travel = 0;
  let lastEventAt = -Infinity;
  return (event: WheelEvent) => {
    if (!event.ctrlKey || event.deltaY === 0) return;
    // Cancel Chromium's own zoom and page scrolling, including at the limits.
    event.preventDefault();
    // Page zoom divides pixel deltas by the frame's factor, so one notch at 150%
    // reports about 67 px. Scale back to unzoomed px to keep one notch one step.
    const delta =
      event.deltaMode === 0
        ? event.deltaY * webFrame.getZoomFactor()
        : Math.sign(event.deltaY) * WHEEL_STEP_DELTA;
    const reversed = Math.sign(delta) !== Math.sign(travel);
    if (reversed || event.timeStamp - lastEventAt > WHEEL_GESTURE_GAP_MS) travel = 0;
    lastEventAt = event.timeStamp;
    travel += delta;
    if (Math.abs(travel) < WHEEL_STEP_DELTA - WHEEL_STEP_TOLERANCE) return;
    travel = 0;
    requestZoom(
      store,
      zoomFromState(store.getState()) - Math.sign(delta) * ZOOM_STEP,
      target,
      events,
    );
  };
}

/** Works in both layouts. */
function makeKeyHandler(store: Store<IState>, target: Window, events?: ZoomEvents) {
  return (event: KeyboardEvent) => {
    if (!(event.ctrlKey || (process.platform === "darwin" && event.metaKey)) || event.altKey)
      return;
    const direction = event.key === "+" || event.key === "=" ? 1 : event.key === "-" ? -1 : 0;
    if (direction === 0 && event.key !== "0") return;
    event.preventDefault();
    requestZoom(
      store,
      direction === 0 ? 1 : zoomFromState(store.getState()) + direction * ZOOM_STEP,
      target,
      events,
    );
  };
}
