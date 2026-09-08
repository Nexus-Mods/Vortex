import type { DiffOperation } from "@vortex/shared/ipc";
import { applyMiddleware, createStore, type Reducer } from "redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IModRule } from "../extensions/mod_management/types/IMod";
import { makeDownload, makeMod, makeReference, makeRule } from "../test-utils/builders";
import { createPersistDiffMiddleware, flushPendingDiffsSync } from "./persistDiffMiddleware";

type S = Record<string, unknown>;
const initial: S = { app: {}, settings: {}, persistent: {}, confidential: {}, user: {} };
const reducer: Reducer<S> = (state = initial, action: { type: string; payload?: unknown }) =>
  action.type === "SET_PERSISTENT" ? { ...state, persistent: action.payload } : state;

afterEach(() => vi.useRealTimers());

// large enough that a whole-array operation dominates the queued volume
const RULE_COUNT = 800;

/** Rules below `reconciledUpTo` carry the archive's tag, the rest the collection revision's. */
function makeRules(reconciledUpTo: number): IModRule[] {
  return Array.from({ length: RULE_COUNT }, (_, i) =>
    makeRule({
      reference: makeReference({
        tag: i < reconciledUpTo ? `rev54-tag-${i}` : `rev62-tag-${i}`,
        fileMD5: `md5-${i}`,
        logicalFileName: `Mod ${i}`,
        versionMatch: "1.0.0",
      }),
    }),
  );
}

function makeCollectionState(reconciledUpTo: number): S {
  return {
    mods: {
      cyberpunk2077: {
        "collection-1": makeMod({
          id: "collection-1",
          type: "collection",
          rules: makeRules(reconciledUpTo),
        }),
      },
    },
  };
}

const RULES_PATH = "mods.cyberpunk2077.collection-1.rules";

/**
 * The invariant is about the QUEUE, not about rule updates: any code path writing the same state
 * path repeatedly within one debounce window costs the size of the state, not the size multiplied
 * by the number of writes. A collection revision change reconciles member tags one dispatch at a
 * time against a `rules` array that diffs as one whole-array operation (GH#23904).
 */
describe("diff coalescing (GH#23904 renderer OOM)", () => {
  /** exact segment-array comparison - join-based comparison is what these tests guard against */
  const samePath = (op: DiffOperation, parts: string[]) =>
    op.path.length === parts.length && parts.every((seg, i) => op.path[i] === seg);

  /**
   * Drive `ticks` successive writes of the persistent hive through the real middleware, then let
   * the debounce fire. Returns the operations of each resulting sendDiff call.
   */
  const writeTicks = (ticks: number, stateAt: (tick: number) => S): DiffOperation[][] => {
    vi.useFakeTimers();
    const sendDiff = vi.fn();
    const mw = createPersistDiffMiddleware(() => ({ sendDiff }));
    const store = createStore(reducer, applyMiddleware(mw));

    store.dispatch({ type: "INIT" });
    for (let tick = 0; tick <= ticks; ++tick) {
      store.dispatch({ type: "SET_PERSISTENT", payload: stateAt(tick) });
    }
    vi.runAllTimers();

    return sendDiff.mock.calls.map((call) => (call as [string, DiffOperation[]])[1]);
  };

  const rulesOpsIn = (ops: DiffOperation[]) => ops.filter((op) => op.path.join(".") === RULES_PATH);

  it("queues one operation per path regardless of how many writes hit it", () => {
    const [ops] = writeTicks(200, makeCollectionState);

    const ruleOps = rulesOpsIn(ops);
    expect(ruleOps).toHaveLength(1);

    // the surviving operation carries the last write's value
    const rules = ruleOps[0].value as IModRule[];
    expect(rules[199].reference.tag).toBe("rev54-tag-199");
    expect(rules[200].reference.tag).toBe("rev62-tag-200");
  });

  it("keeps queued volume bounded by state size, not by write count", () => {
    const [ops] = writeTicks(200, makeCollectionState);
    // one snapshot of the array is the floor; 2x headroom asserts the shape, not a byte count
    expect(JSON.stringify(ops).length).toBeLessThan(JSON.stringify(makeRules(200)).length * 2);
  });

  it("keeps concurrent writes to other paths while coalescing the hot one", () => {
    // coalescing is per PATH, not per hive: concurrent downloads and installs each keep their
    // own final value while the repeatedly-written path collapses
    const [ops] = writeTicks(200, (tick) => ({
      mods: {
        cyberpunk2077: {
          "collection-1": makeMod({
            id: "collection-1",
            type: "collection",
            rules: makeRules(tick),
          }),
          "installed-a": makeMod({
            id: "installed-a",
            installationPath: `mods/installed-a-${tick}`,
          }),
        },
      },
      downloads: { files: { "dl-a": makeDownload({ id: "dl-a", received: tick }) } },
    }));

    expect(rulesOpsIn(ops)).toHaveLength(1);

    const byPath = new Map(ops.map((op) => [op.path.join("."), op.value]));
    expect(byPath.get("downloads.files.dl-a.received")).toBe(200);
    expect(byPath.get("mods.cyberpunk2077.installed-a.installationPath")).toBe(
      "mods/installed-a-200",
    );
  });

  it("applies a re-added subtree's writes after the subtree remove", () => {
    // set attribute -> remove mod -> re-add mod, all inside one debounce window. The container
    // remove is a subtree DELETE in the persistor (LevelPersist.removeItem), so the re-added
    // attribute write must sort after it: a queue that kept the attribute's original position
    // would let the remove destroy the re-added row inside the same flush.
    const [ops] = writeTicks(2, (tick) =>
      tick === 1
        ? { mods: { cyberpunk2077: {} } }
        : {
            mods: {
              cyberpunk2077: {
                m1: makeMod({ id: "m1", attributes: { a: tick === 0 ? "one" : "two" } }),
              },
            },
          },
    );

    const removeIdx = ops.findIndex(
      (op) => op.type === "remove" && samePath(op, ["mods", "cyberpunk2077", "m1"]),
    );
    const attrOps = ops.filter((op) =>
      samePath(op, ["mods", "cyberpunk2077", "m1", "attributes", "a"]),
    );

    expect(removeIdx).toBeGreaterThanOrEqual(0);
    expect(attrOps).toHaveLength(1);
    expect(attrOps[0].value).toBe("two");
    expect(ops.indexOf(attrOps[0])).toBeGreaterThan(removeIdx);
  });

  it("distinguishes paths that a separator-joined key would merge", () => {
    // mod ids containing dots are common, so ["mods", g, "m1", "attributes", "state"] and
    // ["mods", g, "m1.attributes", "state"] are distinct paths that dot-join to the same
    // string - the queue key must keep them apart or one write is silently dropped
    const [ops] = writeTicks(0, () => ({
      mods: {
        cyberpunk2077: {
          m1: makeMod({ id: "m1", attributes: { state: "attr-value" } }),
          "m1.attributes": makeMod({ id: "m1.attributes" }),
        },
      },
    }));

    const attrOp = ops.find((op) =>
      samePath(op, ["mods", "cyberpunk2077", "m1", "attributes", "state"]),
    );
    const fieldOp = ops.find((op) =>
      samePath(op, ["mods", "cyberpunk2077", "m1.attributes", "state"]),
    );

    expect(attrOp?.value).toBe("attr-value");
    expect(fieldOp?.value).toBe("installed");
  });

  it("still coalesces across separate debounce windows without losing the newest value", () => {
    vi.useFakeTimers();
    const sendDiff = vi.fn();
    const mw = createPersistDiffMiddleware(() => ({ sendDiff }));
    const store = createStore(reducer, applyMiddleware(mw));

    store.dispatch({ type: "INIT" });
    store.dispatch({ type: "SET_PERSISTENT", payload: makeCollectionState(1) });
    vi.runAllTimers();
    store.dispatch({ type: "SET_PERSISTENT", payload: makeCollectionState(2) });
    vi.runAllTimers();

    expect(sendDiff).toHaveBeenCalledTimes(2);
    const [, ops] = sendDiff.mock.calls[1] as [string, DiffOperation[]];
    const rules = rulesOpsIn(ops)[0].value as IModRule[];
    expect(rules[1].reference.tag).toBe("rev54-tag-1");
  });
});

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

/** The only path state takes to disk, so one fault must cost at most one flush window. */
describe("fault tolerance", () => {
  const deliveredValues = (sendDiff: ReturnType<typeof vi.fn>) =>
    sendDiff.mock.calls
      .flatMap((call) => call[1] as DiffOperation[])
      .filter((op) => op.type === "set")
      .map((op) => op.value);

  it("keeps flushing after a send failure", () => {
    vi.useFakeTimers();
    const sendDiff = vi.fn().mockImplementationOnce(() => {
      throw new Error("ipc send failed");
    });
    const mw = createPersistDiffMiddleware(() => ({ sendDiff }));
    const store = createStore(reducer, applyMiddleware(mw));
    store.dispatch({ type: "INIT" });

    store.dispatch({ type: "SET_PERSISTENT", payload: { marker: 1 } });
    // the failing flush is contained by the middleware, not re-thrown out of the timer
    expect(() => vi.runAllTimers()).not.toThrow();

    store.dispatch({ type: "SET_PERSISTENT", payload: { marker: 2 } });
    vi.runAllTimers();

    expect(deliveredValues(sendDiff)).toContain(2);
  });

  it("keeps persisting after a change whose diff computation fails", () => {
    vi.useFakeTimers();
    const sendDiff = vi.fn();
    const mw = createPersistDiffMiddleware(() => ({ sendDiff }));
    const store = createStore(reducer, applyMiddleware(mw));
    store.dispatch({ type: "INIT" });

    // collecting this subtree recurses once per nesting level, so the diff dies on stack depth
    let bomb: unknown = 1;
    for (let i = 0; i < 100_000; i++) {
      bomb = { d: bomb };
    }
    expect(() =>
      store.dispatch({ type: "SET_PERSISTENT", payload: { marker: 1, bomb } }),
    ).not.toThrow();

    store.dispatch({ type: "SET_PERSISTENT", payload: { marker: 1, second: 2 } });
    vi.runAllTimers();

    const values = deliveredValues(sendDiff);
    expect(values).toContain(2);
    // the change from the failed window rides the next successful diff
    expect(values).toContain(1);
  });
});
