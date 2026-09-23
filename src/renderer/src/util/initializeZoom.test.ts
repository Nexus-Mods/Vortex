import { webFrame } from "electron";
import { createStore, type AnyAction } from "redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setUseModernLayout, setZoomFactor } from "../actions/window";
import { windowReducer } from "../reducers/window";
import type { IState } from "../types/IState";
import { initializeZoom } from "./initializeZoom";
import { normalizeZoom } from "./zoom";

vi.mock("electron", () => ({ webFrame: { setZoomFactor: vi.fn() } }));

function makeStore(factor = 1, useModernLayout = true) {
  const initial = {
    settings: { window: { ...windowReducer.defaults, zoomFactor: factor, useModernLayout } },
  } as unknown as IState;
  return createStore(
    (state: IState = initial, action: AnyAction): IState => ({
      ...state,
      settings: {
        ...state.settings,
        window: [setZoomFactor.getType(), setUseModernLayout.getType()].includes(action.type)
          ? (windowReducer.reducers[action.type](
              state.settings.window as typeof windowReducer.defaults,
              action.payload,
            ) as typeof state.settings.window)
          : state.settings.window,
      },
    }),
  );
}

// happy-dom's WheelEvent currently extends UIEvent and omits modifier keys.
function wheel(options: WheelEventInit): WheelEvent {
  const event = new WheelEvent("wheel", options);
  Object.defineProperty(event, "ctrlKey", { value: options.ctrlKey ?? false });
  return event;
}

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  vi.clearAllMocks();
});

describe("zoom", () => {
  it.each([
    [0, 0.5],
    [2, 1.5],
    [NaN, 1],
    [Infinity, 1],
    [1.2000000002, 1.2],
  ])("normalizes %s to %s", (value, expected) => expect(normalizeZoom(value)).toBe(expected));

  it("restores saved zoom and applies store changes only when zoom changes", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(1);
    expect(document.documentElement.style.zoom).toBe("1.2");
    store.dispatch(setZoomFactor(0.8));
    expect(document.documentElement.style.zoom).toBe("0.8");
    expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("0.8");
    store.dispatch({ type: "UNRELATED" });
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(1);
  });

  it("zooms with Ctrl+wheel, blocks native zoom at limits, and leaves ordinary scrolling alone", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    const scroll = wheel({ deltaY: -120, cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
    expect(store.getState().settings.window.zoomFactor).toBe(1);
    for (let i = 0; i < 10; ++i) {
      const zoom = wheel({ ctrlKey: true, deltaY: -120, cancelable: true });
      window.dispatchEvent(zoom);
      expect(zoom.defaultPrevented).toBe(true);
    }
    expect(store.getState().settings.window.zoomFactor).toBe(1.5);
    window.dispatchEvent(wheel({ ctrlKey: true, deltaY: 120 }));
    expect(store.getState().settings.window.zoomFactor).toBe(1.4);
    store.dispatch(setZoomFactor(0.5));
    window.dispatchEvent(wheel({ ctrlKey: true, deltaY: 120 }));
    expect(store.getState().settings.window.zoomFactor).toBe(0.5);
  });

  it("removes the listener and subscription on cleanup", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    dispose();
    window.dispatchEvent(wheel({ ctrlKey: true, deltaY: -120 }));
    expect(store.getState().settings.window.zoomFactor).toBe(1);
    store.dispatch(setZoomFactor(1.2));
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.zoom).toBe("");
  });

  it("preserves legacy zoom and leaves its shortcuts and state updates alone", () => {
    const store = makeStore(1.234, false);
    dispose = initializeZoom(store);
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(1.234);
    const scroll = wheel({ ctrlKey: true, deltaY: -120, cancelable: true });
    const key = new KeyboardEvent("keydown", { key: "=", ctrlKey: true, cancelable: true });
    window.dispatchEvent(scroll);
    window.dispatchEvent(key);
    expect(scroll.defaultPrevented).toBe(false);
    expect(key.defaultPrevented).toBe(false);
    expect(store.getState().settings.window.zoomFactor).toBe(1.234);
    store.dispatch(setZoomFactor(0.876));
    expect(store.getState().settings.window.zoomFactor).toBe(0.876);
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(1);
  });

  it("supports Ctrl+plus, equals, minus and zero without requiring Shift", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    for (const [key, expected] of [
      ["=", 1.1],
      ["+", 1.2],
      ["-", 1.1],
      ["0", 1],
    ] as const) {
      const event = new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(store.getState().settings.window.zoomFactor).toBe(expected);
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "-" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "+", ctrlKey: true, altKey: true }));
    expect(store.getState().settings.window.zoomFactor).toBe(1);
  });

  it("reapplies modern zoom after legacy menu actions have changed the frame", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    store.dispatch(setUseModernLayout(false));
    store.dispatch(setZoomFactor(0.8));
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(2);
    expect(document.documentElement.style.zoom).toBe("");
    store.dispatch(setZoomFactor(1.2));
    store.dispatch(setUseModernLayout(true));
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(3);
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(1);
    expect(document.documentElement.style.zoom).toBe("1.2");
  });
});
