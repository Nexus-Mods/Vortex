import type { DiffOperation } from "@vortex/shared/ipc";
import type { IPersistor, PersistorKey } from "@vortex/shared/state";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub terminate so a faulted processOperations doesn't try to show a dialog.
// Re-throwing keeps the same control flow as the real terminate (synchronous
// throw caught by the outer queue catch).
vi.mock("../errorHandling", () => ({
  terminate: (err: Error) => {
    throw err;
  },
}));

// Suppress log noise from the queue's catch handler.
vi.mock("../logging", () => ({
  log: vi.fn(),
}));

import type LevelPersist from "./LevelPersist";
import type QueryInvalidator from "./QueryInvalidator";
import ReduxPersistorIPC from "./ReduxPersistorIPC";

type MockPersistor = IPersistor & {
  bulkSetItem: ReturnType<typeof vi.fn>;
  bulkRemoveItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function createBulkPersistor(): MockPersistor {
  return {
    setResetCallback: vi.fn(),
    getItem: vi.fn().mockResolvedValue(""),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    getAllKVs: vi.fn().mockResolvedValue([]),
    bulkSetItem: vi.fn().mockResolvedValue(undefined),
    bulkRemoveItem: vi.fn().mockResolvedValue(undefined),
  };
}

function createNonBulkPersistor(): IPersistor & {
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
} {
  return {
    setResetCallback: vi.fn(),
    getItem: vi.fn().mockResolvedValue(""),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    getAllKVs: vi.fn().mockResolvedValue([]),
  };
}

function createMockLevelPersist() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    getDirtyTables: vi.fn().mockResolvedValue([]),
  };
}

function createMockInvalidator() {
  return { notifyDirtyTables: vi.fn() };
}

function set(path: PersistorKey, value: unknown): DiffOperation {
  return { type: "set", path, value };
}

function remove(path: PersistorKey): DiffOperation {
  return { type: "remove", path };
}

async function setupIPC(persistor: IPersistor) {
  const ipc = new ReduxPersistorIPC();
  const levelPersist = createMockLevelPersist();
  const invalidator = createMockInvalidator();
  ipc.setQueryInvalidator(
    levelPersist as unknown as LevelPersist,
    invalidator as unknown as QueryInvalidator,
  );
  await ipc.insertPersistor("test", persistor);
  return { ipc, levelPersist, invalidator };
}

describe("ReduxPersistorIPC: run grouping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("collapses a uniform set run into one bulkSetItem call", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [set(["a"], "1"), set(["b"], "2"), set(["c"], "3")]);
    await ipc.finalizeWrite();

    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(1);
    expect(persistor.bulkRemoveItem).not.toHaveBeenCalled();

    const items = persistor.bulkSetItem.mock.calls[0][0] as Array<{
      key: PersistorKey;
      value: string;
    }>;
    expect(items.map((i) => i.key)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("collapses a uniform remove run into one bulkRemoveItem call", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [remove(["a"]), remove(["b"]), remove(["c"])]);
    await ipc.finalizeWrite();

    expect(persistor.bulkRemoveItem).toHaveBeenCalledTimes(1);
    expect(persistor.bulkSetItem).not.toHaveBeenCalled();
  });

  it("preserves order across type boundaries (set, remove, set)", async () => {
    const persistor = createBulkPersistor();
    // Record the dispatch order via a shared call log rather than reading
    // it back out of two separate mock-call lists.
    const callLog: Array<"set" | "remove"> = [];
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    persistor.bulkSetItem.mockImplementation((): Promise<void> => {
      callLog.push("set");
      return Promise.resolve();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    persistor.bulkRemoveItem.mockImplementation((): Promise<void> => {
      callLog.push("remove");
      return Promise.resolve();
    });
    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [
      set(["a"], "1"),
      set(["b"], "2"),
      remove(["c"]),
      remove(["d"]),
      set(["e"], "5"),
    ]);
    await ipc.finalizeWrite();

    expect(callLog).toEqual(["set", "remove", "set"]);
    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(2);
    expect(persistor.bulkRemoveItem).toHaveBeenCalledTimes(1);
  });
});

describe("ReduxPersistorIPC: chunking at BULK_CHUNK_SIZE (256)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits a single bulk call for exactly 256 set operations", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    const ops = Array.from({ length: 256 }, (_, i) => set([`k${i}`], `v${i}`));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(1);
    const items = persistor.bulkSetItem.mock.calls[0][0] as Array<unknown>;
    expect(items.length).toBe(256);
  });

  it("splits 257 ops into chunks of 256 + 1", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    const ops = Array.from({ length: 257 }, (_, i) => set([`k${i}`], `v${i}`));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(2);
    expect((persistor.bulkSetItem.mock.calls[0][0] as Array<unknown>).length).toBe(256);
    expect((persistor.bulkSetItem.mock.calls[1][0] as Array<unknown>).length).toBe(1);
  });

  it("splits a 1002-op set run into 4 chunks (256+256+256+234)", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    const ops = Array.from({ length: 1002 }, (_, i) => set([`k${i}`], `v${i}`));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(4);
    const sizes = persistor.bulkSetItem.mock.calls.map((c) => (c[0] as Array<unknown>).length);
    expect(sizes).toEqual([256, 256, 256, 234]);

    // First key of each chunk advances by 256, last chunk has the tail.
    const firstKeys = persistor.bulkSetItem.mock.calls.map((c) => {
      const items = c[0] as Array<{ key: PersistorKey }>;
      return items[0].key[0];
    });
    expect(firstKeys).toEqual(["k0", "k256", "k512", "k768"]);
  });

  it("chunks remove runs with the same boundary", async () => {
    const persistor = createBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    const ops = Array.from({ length: 300 }, (_, i) => remove([`k${i}`]));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    expect(persistor.bulkRemoveItem).toHaveBeenCalledTimes(2);
    const sizes = persistor.bulkRemoveItem.mock.calls.map((c) => (c[0] as Array<unknown>).length);
    expect(sizes).toEqual([256, 44]);
  });
});

describe("ReduxPersistorIPC: fallback when bulk methods are absent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falls back to per-op setItem when persistor lacks bulkSetItem", async () => {
    const persistor = createNonBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [set(["a"], "1"), set(["b"], "2"), set(["c"], "3")]);
    await ipc.finalizeWrite();

    expect(persistor.setItem).toHaveBeenCalledTimes(3);
    expect(persistor.setItem).toHaveBeenNthCalledWith(1, ["a"], '"1"');
    expect(persistor.setItem).toHaveBeenNthCalledWith(2, ["b"], '"2"');
    expect(persistor.setItem).toHaveBeenNthCalledWith(3, ["c"], '"3"');
  });

  it("falls back to per-op removeItem when persistor lacks bulkRemoveItem", async () => {
    const persistor = createNonBulkPersistor();
    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [remove(["a"]), remove(["b"])]);
    await ipc.finalizeWrite();

    expect(persistor.removeItem).toHaveBeenCalledTimes(2);
  });
});

describe("ReduxPersistorIPC: transaction wrapping and dirty-table notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wraps each diff in BEGIN…COMMIT and notifies dirty tables", async () => {
    const persistor = createBulkPersistor();
    const { ipc, levelPersist, invalidator } = await setupIPC(persistor);
    levelPersist.getDirtyTables.mockResolvedValue([{ database: "db", table: "kv", type: "raw" }]);

    ipc.applyDiffOperations("test", [set(["a"], "1")]);
    await ipc.finalizeWrite();

    expect(levelPersist.beginTransaction).toHaveBeenCalledTimes(1);
    expect(levelPersist.getDirtyTables).toHaveBeenCalledTimes(1);
    expect(levelPersist.commitTransaction).toHaveBeenCalledTimes(1);
    expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith([
      { database: "db", table: "kv", type: "raw" },
    ]);
    expect(levelPersist.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("does not notify dirty tables when none changed", async () => {
    const persistor = createBulkPersistor();
    const { ipc, levelPersist, invalidator } = await setupIPC(persistor);
    levelPersist.getDirtyTables.mockResolvedValue([]);

    ipc.applyDiffOperations("test", [set(["a"], "1")]);
    await ipc.finalizeWrite();

    expect(invalidator.notifyDirtyTables).not.toHaveBeenCalled();
  });
});

describe("ReduxPersistorIPC: atomicity under partial failure (force-close simulation)", () => {
  beforeEach(() => vi.clearAllMocks());

  // What this test models:
  //
  // The renderer pushes a multi-chunk diff while the user force-closes the
  // app (or the OS / disk introduces a write error). We can't actually
  // SIGKILL inside the test, so we simulate the failure point by making
  // one of the bulk writes throw - the same shape the queue would
  // observe if a LevelDB Write reported an error mid-transaction.
  //
  // We assert two recovery properties:
  //   1. ROLLBACK is issued for the in-flight DuckDB transaction so a
  //      stale BEGIN can't block a future caller.
  //   2. Bulk calls *after* the failure point do not run, bounding
  //      worst-case data loss to one chunk's worth of writes (256 ops
  //      with the current BULK_CHUNK_SIZE).
  //
  // Note: at the LevelDB layer, each chunk's batch.commit is its own
  // atomic Write - so chunks the persistor *did* successfully apply
  // before the failure are durable independently of the DuckDB
  // ROLLBACK. This test verifies that the queue stops dispatching
  // additional chunks rather than charging on through the rest.

  it("rolls back and stops dispatch when a bulk chunk fails mid-transaction", async () => {
    const persistor = createBulkPersistor();

    // Succeed on the first chunk, fail on the second, never reach the third.
    persistor.bulkSetItem
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("simulated mid-transaction failure"))
      .mockResolvedValueOnce(undefined);

    const { ipc, levelPersist, invalidator } = await setupIPC(persistor);

    // 700 ops -> 256 + 256 + 188 chunks
    const ops = Array.from({ length: 700 }, (_, i) => set([`k${i}`], `v${i}`));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    // Exactly two chunks attempted: chunk #1 succeeded, chunk #2 threw,
    // chunk #3 never ran.
    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(2);

    // The transaction was rolled back rather than committed.
    expect(levelPersist.beginTransaction).toHaveBeenCalledTimes(1);
    expect(levelPersist.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(levelPersist.commitTransaction).not.toHaveBeenCalled();

    // Dirty-table notifications must not fire on a failed transaction -
    // consumers would otherwise observe phantom invalidations for state
    // that didn't actually commit.
    expect(invalidator.notifyDirtyTables).not.toHaveBeenCalled();
  });

  it("survives a rollback that itself fails - queue continues", async () => {
    const persistor = createBulkPersistor();
    persistor.bulkSetItem.mockRejectedValueOnce(new Error("write failed"));

    const { ipc, levelPersist } = await setupIPC(persistor);
    levelPersist.rollbackTransaction.mockRejectedValueOnce(new Error("rollback failed"));

    // First diff fails.
    ipc.applyDiffOperations("test", [set(["a"], "1")]);

    // Subsequent diff must still drain - the queue's catch handler must
    // not let the rejection propagate and block the chain.
    ipc.applyDiffOperations("test", [set(["b"], "2")]);

    await expect(ipc.finalizeWrite()).resolves.toBeUndefined();

    // Both diffs were attempted (the second one's bulkSetItem ran fine).
    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(2);
  });

  it("does not partially apply ops after the failure point within the same diff", async () => {
    const persistor = createBulkPersistor();
    // Fail on the very first chunk.
    persistor.bulkSetItem.mockRejectedValueOnce(new Error("disk error"));

    const { ipc } = await setupIPC(persistor);

    const ops = Array.from({ length: 600 }, (_, i) => set([`k${i}`], `v${i}`));
    ipc.applyDiffOperations("test", ops);
    await ipc.finalizeWrite();

    // 600 ops would be 3 chunks (256+256+88) on success. After the first
    // chunk throws, no further chunks may run.
    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(1);
  });

  it("queue stays in order: a later diff is not processed before an earlier one finishes", async () => {
    const persistor = createBulkPersistor();
    // Hold the first bulk call in flight via a deferred promise so we can
    // observe ordering.
    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    persistor.bulkSetItem.mockImplementationOnce(() => blocker);

    const { ipc } = await setupIPC(persistor);

    ipc.applyDiffOperations("test", [set(["first"], "1")]);
    ipc.applyDiffOperations("test", [set(["second"], "2")]);

    // Give microtasks a chance to drain. Only the first diff's bulk call
    // should have been issued so far - the second is queued behind it.
    await Promise.resolve();
    await Promise.resolve();
    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(1);
    expect(
      (
        persistor.bulkSetItem.mock.calls[0][0] as Array<{
          key: PersistorKey;
        }>
      )[0].key[0],
    ).toBe("first");

    release();
    await ipc.finalizeWrite();

    expect(persistor.bulkSetItem).toHaveBeenCalledTimes(2);
    expect(
      (
        persistor.bulkSetItem.mock.calls[1][0] as Array<{
          key: PersistorKey;
        }>
      )[0].key[0],
    ).toBe("second");
  });
});
