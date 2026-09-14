import { describe, expect, onTestFinished, vi } from "vitest";

import { makePluginCombined } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../test-utils/harnessTypes";
import { lockPluginIndex } from "./actions/indexlock";
import { setPluginOrder } from "./actions/loadOrder";
import { genLockIndexAttribute, onceIndexLock } from "./indexlock";

const ORDER = ["A.esp", "B.esp", "C.esp", "D.esp"];

// wire the index lock and capture what it emits on set-plugin-list
function wire(harness: IGamebryoHarness, isDeploying: () => boolean = () => false) {
  const emitted = vi.fn<(plugins: string[], setEnabled: boolean) => void>();
  harness.api.events.on("set-plugin-list", emitted);
  onceIndexLock(harness.api, isDeploying);
  return emitted;
}

describe("index locking", () => {
  test("shows the locked index of a mixed-case plugin in the lock column", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(lockPluginIndex(harness.gameId, "MixedCase.esp", 5));
    const attribute = genLockIndexAttribute(harness.api);

    expect(
      attribute.calc?.(makePluginCombined({ name: "MixedCase.esp" }), harness.api.translate),
    ).toBe(5);
  });

  test("leaves the load order alone while nothing is locked", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    const emitted = wire(harness);

    harness.api.store.dispatch(setPluginOrder(ORDER, true));

    expect(emitted).not.toHaveBeenCalled();
  });

  test("re-inserts a locked plugin at its index when the load order changes", ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(lockPluginIndex(harness.gameId, "C.esp", 1));
    const emitted = wire(harness);

    harness.api.store.dispatch(setPluginOrder(ORDER, true));

    expect(emitted).toHaveBeenCalledWith(["A.esp", "C.esp", "B.esp", "D.esp"], false);
  });

  test("appends a locked plugin whose index lies beyond the list", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(lockPluginIndex(harness.gameId, "B.esp", 9));
    const emitted = wire(harness);

    harness.api.store.dispatch(setPluginOrder(ORDER, true));

    expect(emitted).toHaveBeenCalledWith(["A.esp", "C.esp", "D.esp", "B.esp"], false);
  });

  test("holds off re-applying locks while a deployment runs", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(lockPluginIndex(harness.gameId, "C.esp", 1));
    const emitted = wire(harness, () => true);

    harness.api.store.dispatch(setPluginOrder(ORDER, true));

    expect(emitted).not.toHaveBeenCalled();
  });

  test("re-applies locks two seconds after a lock changes", ({ makeGamebryo }) => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const harness = makeGamebryo();
    harness.api.store.dispatch(setPluginOrder(ORDER, true));
    const emitted = wire(harness);

    harness.api.store.dispatch(lockPluginIndex(harness.gameId, "C.esp", 1));
    expect(emitted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);

    expect(emitted).toHaveBeenCalledWith(["A.esp", "C.esp", "B.esp", "D.esp"], false);
  });
});
