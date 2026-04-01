import { describe, it, expect } from "vitest";

import * as actions from ".";

describe("addNotification", () => {
  it("creates the correct action for minimal case", () => {
    const minimal = {
      message: "sample",
      type: "info",
    };

    const expected = {
      type: "ADD_NOTIFICATION",
      payload: minimal,
      error: false,
    };

    expect(actions.startNotification(minimal)).toEqual(expected);
  });

  it("creates the correct action if everything specified", () => {
    const complete = {
      id: "__test",
      message: "sample",
      displayMS: 42,
      type: "info",
      actions: [{ title: "test", action: () => undefined }],
    };

    expect(actions.startNotification(complete)).toEqual({
      error: false,
      type: "ADD_NOTIFICATION",
      payload: complete,
    });
  });
});

describe("dismissNotification", () => {
  it("creates the correct action", () => {
    expect(actions.stopNotification("__test")).toEqual({
      error: false,
      type: "STOP_NOTIFICATION",
      payload: "__test",
    });
  });
});

describe("setWindowSize", () => {
  it("creates the correct action", () => {
    const size = { width: 42, height: 13 };
    expect(actions.setWindowSize(size)).toEqual({
      error: false,
      type: "STORE_WINDOW_SIZE",
      payload: size,
    });
  });
});

describe("setWindowPosition", () => {
  it("creates the correct action", () => {
    const pos = { x: 1, y: 2 };
    expect(actions.setWindowPosition(pos)).toEqual({
      error: false,
      type: "STORE_WINDOW_POSITION",
      payload: pos,
    });
  });
});

describe("setMaximized", () => {
  it("creates the correct action", () => {
    expect(actions.setMaximized(true)).toEqual({
      error: false,
      type: "SET_MAXIMIZED",
      payload: true,
    });
  });
});

describe("setTabsMinimized", () => {
  it("creates the correct action", () => {
    expect(actions.setTabsMinimized(true)).toEqual({
      error: false,
      type: "SET_TABS_MINIMIZED",
      payload: true,
    });
  });
});
