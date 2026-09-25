import { readFileSync } from "node:fs";
import * as path from "node:path";

import { webFrame } from "electron";
import { createStore, type AnyAction } from "redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setUseModernLayout, setZoomFactor } from "../actions/window";
import { windowReducer } from "../reducers/window";
import type { IState } from "../types/IState";
import { initializeZoom } from "./initializeZoom";
import { normalizeZoom, ZOOM_SHORTCUT_EVENT } from "./zoom";

/** Models the frame: the factor set is the factor read back, as in Electron. */
const frame = vi.hoisted(() => ({ factor: 1 }));
vi.mock("electron", () => ({
  webFrame: {
    getZoomFactor: vi.fn(() => frame.factor),
    setZoomFactor: vi.fn((factor: number) => {
      frame.factor = factor;
    }),
  },
}));

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
function wheel(options: WheelEventInit & { timeStamp?: number }): WheelEvent {
  const event = new WheelEvent("wheel", options);
  Object.defineProperty(event, "ctrlKey", { value: options.ctrlKey ?? false });
  Object.defineProperty(event, "deltaY", { value: options.deltaY ?? 0 });
  Object.defineProperty(event, "deltaMode", { value: options.deltaMode ?? 0 });
  Object.defineProperty(event, "timeStamp", { value: options.timeStamp ?? 0 });
  return event;
}

const pinch = (deltaY: number, timeStamp = 0) =>
  window.dispatchEvent(wheel({ ctrlKey: true, deltaY, cancelable: true, timeStamp }));

const appZoom = () => document.documentElement.style.getPropertyValue("--app-zoom");
const zoomOf = (store: ReturnType<typeof makeStore>) => store.getState().settings.window.zoomFactor;

let dispose: (() => void) | undefined;
beforeEach(() => {
  frame.factor = 1;
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
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

  // CSS zoom on the page leaves event coordinates unzoomed while scaling
  // positions set inside it, so every pointer-placed menu would open away
  // from the cursor. Page zoom keeps them in one space.
  it("zooms the modern layout with the frame's page zoom, never CSS zoom on the page", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(1.2);
    store.dispatch(setZoomFactor(0.8));
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(0.8);
    expect(document.documentElement.style.zoom).toBe("");
    expect(document.body.style.zoom).toBe("");
  });

  it("publishes the frame's factor for the chrome in the same update", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    expect(appZoom()).toBe("1.2");
    store.dispatch(setZoomFactor(0.8));
    expect(appZoom()).toBe("0.8");
    store.dispatch({ type: "UNRELATED" });
    expect(webFrame.setZoomFactor).toHaveBeenCalledTimes(2);
  });

  it("puts the frame back and resyncs the chrome when Chromium changes the zoom behind it", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    frame.factor = 0.9;
    window.dispatchEvent(new Event("resize"));
    expect(frame.factor).toBe(1.2);
    expect(appZoom()).toBe("1.2");
  });

  it("steps once per notch of wheel travel, however many events carry it", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    for (let i = 0; i < 5; ++i) pinch(-4);
    expect(zoomOf(store)).toBe(1);
    for (let i = 0; i < 20; ++i) pinch(-4);
    expect(zoomOf(store)).toBe(1.1);
    pinch(-120);
    pinch(-120);
    expect(zoomOf(store)).toBe(1.3);
  });

  it("drops a partial step when the gesture reverses or pauses", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    pinch(-60, 0);
    pinch(50, 10);
    pinch(40, 20);
    expect(zoomOf(store)).toBe(1);
    pinch(60, 30);
    expect(zoomOf(store)).toBe(0.9);
    pinch(-60, 40);
    pinch(-60, 1000);
    expect(zoomOf(store)).toBe(0.9);
  });

  it("treats a line- or page-mode wheel event as a whole notch", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    window.dispatchEvent(wheel({ ctrlKey: true, deltaY: -3, deltaMode: 1 }));
    expect(zoomOf(store)).toBe(1.1);
  });

  it("blocks native zoom at the limits and leaves ordinary scrolling alone", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    const scroll = wheel({ deltaY: -120, cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
    for (let i = 0; i < 10; ++i) {
      const zoom = wheel({ ctrlKey: true, deltaY: -120, cancelable: true });
      window.dispatchEvent(zoom);
      expect(zoom.defaultPrevented).toBe(true);
    }
    expect(zoomOf(store)).toBe(1.5);
    pinch(120);
    expect(zoomOf(store)).toBe(1.4);
  });

  it("announces each shortcut step so the zoom feedback can show", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    const listener = vi.fn();
    window.addEventListener(ZOOM_SHORTCUT_EVENT, listener);
    pinch(-120);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", ctrlKey: true }));
    window.removeEventListener(ZOOM_SHORTCUT_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("removes the listeners, subscription and chrome factor on cleanup", () => {
    const store = makeStore();
    dispose = initializeZoom(store);
    dispose();
    pinch(-120);
    expect(zoomOf(store)).toBe(1);
    store.dispatch(setZoomFactor(1.2));
    expect(frame.factor).toBe(1);
    expect(appZoom()).toBe("");
  });

  it("keeps a legacy saved factor as it is and leaves its shortcuts to the menu", () => {
    const store = makeStore(1.234, false);
    dispose = initializeZoom(store);
    expect(frame.factor).toBe(1.234);
    expect(appZoom()).toBe("");
    const scroll = wheel({ ctrlKey: true, deltaY: -120, cancelable: true });
    const key = new KeyboardEvent("keydown", { key: "=", ctrlKey: true, cancelable: true });
    window.dispatchEvent(scroll);
    window.dispatchEvent(key);
    expect(scroll.defaultPrevented).toBe(false);
    expect(key.defaultPrevented).toBe(false);
    expect(zoomOf(store)).toBe(1.234);
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
      expect(zoomOf(store)).toBe(expected);
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "-" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "+", ctrlKey: true, altKey: true }));
    expect(zoomOf(store)).toBe(1);
  });

  it("follows a switch between layouts", () => {
    const store = makeStore(1.2);
    dispose = initializeZoom(store);
    store.dispatch(setUseModernLayout(false));
    expect(appZoom()).toBe("");
    store.dispatch(setZoomFactor(0.8));
    expect(frame.factor).toBe(0.8);
    store.dispatch(setUseModernLayout(true));
    expect(frame.factor).toBe(0.8);
    expect(appZoom()).toBe("0.8");
  });

  // renderer.tsx cannot be imported in a unit test, so this guards the one call
  // that installs everything above.
  it("is installed by the renderer at startup", () => {
    const source = readFileSync(path.join(__dirname, "..", "renderer.tsx"), "utf8");
    expect(source).toMatch(/\binitializeZoom\(store\);/);
  });
});
