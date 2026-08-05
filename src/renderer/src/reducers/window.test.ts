import { describe, it, expect } from "vitest";

import { defaultState, windowReducer } from "./window";

describe("setWindowSize", () => {
  it("sets the size", () => {
    const result = windowReducer.reducers.STORE_WINDOW_SIZE(defaultState, {
      width: 1,
      height: 2,
    });
    expect(result.size).toEqual({ width: 1, height: 2 });
  });
});

describe("setWindowPosition", () => {
  it("sets the window position", () => {
    const result = windowReducer.reducers.STORE_WINDOW_POSITION(defaultState, {
      x: 1,
      y: 2,
    });
    expect(result.position).toEqual({ x: 1, y: 2 });
  });
});

describe("setMaximized", () => {
  it("sets the window maximized", () => {
    const result = windowReducer.reducers.SET_MAXIMIZED(defaultState, true);
    expect(result.maximized).toBe(true);
  });
});

describe("setTabsMinimized", () => {
  it("makes tabs minimized", () => {
    const result = windowReducer.reducers.SET_TABS_MINIMIZED(defaultState, true);
    expect(result.tabsMinimized).toBe(true);
  });
});
