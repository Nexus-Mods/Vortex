import { afterEach, describe, expect, it, vi } from "vitest";

import { test } from "@/test-utils/harnessTest";
import type { INotification } from "@/types/INotification";

import * as actions from ".";

describe("addNotification suppression", () => {
  afterEach(() => {
    actions.setupNotificationSuppression(() => false);
  });

  test("drops a notification the user has suppressed", async ({ makeApi }) => {
    const harness = makeApi();
    actions.setupNotificationSuppression((id) => id === "__hidden");

    await harness.api.store.dispatch(
      actions.addNotification({ id: "__hidden", type: "warning", message: "sample" }),
    );

    expect(harness.dispatched.map((action) => action.type)).toEqual([]);
  });

  test("shows a notification that may not be suppressed despite an earlier suppression", async ({
    makeApi,
  }) => {
    const harness = makeApi();
    actions.setupNotificationSuppression((id) => id === "__kept");

    await harness.api.store.dispatch(
      actions.addNotification({
        id: "__kept",
        type: "warning",
        message: "sample",
        allowSuppress: false,
      }),
    );

    expect(harness.dispatched.map((action) => action.type)).toEqual(["ADD_NOTIFICATION"]);
  });
});

describe("addNotification timing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("stamps a timed notification's updatedTime to the millisecond, not the second", ({
    makeApi,
  }) => {
    const harness = makeApi();
    const now = new Date("2026-11-23T12:00:00.950Z").getTime();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now });

    // Not awaited: it resolves only once displayMS has passed and it's dismissed.
    void harness.api.store.dispatch(
      actions.addNotification({
        id: "__timed",
        type: "success",
        message: "sample",
        displayMS: 2000,
      }),
    );

    const [added] = harness.dispatched;
    expect((added.payload as INotification).updatedTime).toBe(now);
  });
});

describe("addNotification", () => {
  it("creates the correct action for minimal case", () => {
    const minimal = {
      message: "sample",
      type: "info",
    } satisfies INotification;

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
    } satisfies INotification;

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
