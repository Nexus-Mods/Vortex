import { applyMiddleware, createStore, type Reducer } from "redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPersistDiffMiddleware, flushPendingDiffsSync } from "./persistDiffMiddleware";

type S = Record<string, unknown>;
const initial: S = { app: {}, settings: {}, persistent: {}, confidential: {}, user: {} };
const reducer: Reducer<S> = (state = initial, action: { type: string; payload?: unknown }) =>
  action.type === "SET_PERSISTENT" ? { ...state, persistent: action.payload } : state;

afterEach(() => vi.useRealTimers());

describe("flushPendingDiffsSync (GH#23363 quit flush)", () => {
  it("flushes pending diffs synchronously via sendDiffSync before the debounce fires", () => {
    vi.useFakeTimers();
    const sendDiff = vi.fn();
    const sendDiffSync = vi.fn();
    const mw = createPersistDiffMiddleware(() => ({ sendDiff, sendDiffSync }));
    const store = createStore(reducer, applyMiddleware(mw));

    store.dispatch({ type: "INIT" }); // initializes previousState
    store.dispatch({
      type: "SET_PERSISTENT",
      payload: { mods: { skyrimse: { m1: { installationPath: "m1" } } } },
    });

    // the 100ms debounce has not elapsed, so nothing has been sent yet
    expect(sendDiff).not.toHaveBeenCalled();

    flushPendingDiffsSync();

    expect(sendDiffSync).toHaveBeenCalledTimes(1);
    const [hive, ops] = sendDiffSync.mock.calls[0] as [string, Array<{ path: string[] }>];
    expect(hive).toBe("persistent");
    expect(ops.map((o) => o.path.join("."))).toContain("mods.skyrimse.m1.installationPath");

    // the async debounced path must not also fire (writes already flushed + cleared)
    vi.runAllTimers();
    expect(sendDiff).not.toHaveBeenCalled();
  });

  it("falls back to sendDiff when sendDiffSync is unavailable", () => {
    vi.useFakeTimers();
    const sendDiff = vi.fn();
    const mw = createPersistDiffMiddleware(() => ({ sendDiff }));
    const store = createStore(reducer, applyMiddleware(mw));

    store.dispatch({ type: "INIT" });
    store.dispatch({
      type: "SET_PERSISTENT",
      payload: { mods: { g: { m2: { installationPath: "m2" } } } },
    });

    flushPendingDiffsSync();

    expect(sendDiff).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when there are no pending diffs", () => {
    const sendDiff = vi.fn();
    const sendDiffSync = vi.fn();
    createPersistDiffMiddleware(() => ({ sendDiff, sendDiffSync }));

    flushPendingDiffsSync();

    expect(sendDiffSync).not.toHaveBeenCalled();
    expect(sendDiff).not.toHaveBeenCalled();
  });
});
