import type { IPersistor, PersistorKey } from "@vortex/shared/state";

import { describe, it, expect, vi } from "vitest";

import SubPersistor from "./SubPersistor";

function createWrappedWithBulk() {
  const setItem = vi.fn().mockResolvedValue(undefined);
  const removeItem = vi.fn().mockResolvedValue(undefined);
  const getAllKVs = vi.fn().mockResolvedValue([]);
  const bulkSetItem = vi.fn().mockResolvedValue(undefined);
  const bulkRemoveItem = vi.fn().mockResolvedValue(undefined);
  const wrapped: IPersistor = {
    setResetCallback: vi.fn(),
    getItem: vi.fn().mockResolvedValue("value"),
    setItem,
    removeItem,
    getAllKeys: vi.fn().mockResolvedValue([]),
    getAllKVs,
    bulkSetItem,
    bulkRemoveItem,
  };
  return { wrapped, setItem, removeItem, getAllKVs, bulkSetItem, bulkRemoveItem };
}

function createWrappedWithoutBulk(): IPersistor {
  return {
    setResetCallback: vi.fn(),
    getItem: vi.fn().mockResolvedValue("value"),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
  };
}

describe("SubPersistor key prefixing (single-item)", () => {
  it("setItem prepends the hive to the key path", async () => {
    const { wrapped, setItem } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");

    await sub.setItem(["window", "x"], "42");

    expect(setItem).toHaveBeenCalledWith(["settings", "window", "x"], "42");
  });

  it("removeItem prepends the hive to the key path", async () => {
    const { wrapped, removeItem } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");

    await sub.removeItem(["window", "x"]);

    expect(removeItem).toHaveBeenCalledWith(["settings", "window", "x"]);
  });
});

describe("SubPersistor.bulkSetItem", () => {
  it("is exposed when the wrapped persistor exposes it", () => {
    const { wrapped } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");
    expect(typeof sub.bulkSetItem).toBe("function");
  });

  it("is undefined when the wrapped persistor does not expose it", () => {
    const sub = new SubPersistor(createWrappedWithoutBulk(), "settings");
    expect(sub.bulkSetItem).toBeUndefined();
  });

  it("prepends the hive to every item's key path", async () => {
    const { wrapped, bulkSetItem } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "app");

    await sub.bulkSetItem([
      { key: ["extensions", "ext1", "remove"], value: "true" },
      { key: ["extensions", "ext2", "remove"], value: "true" },
    ]);

    expect(bulkSetItem).toHaveBeenCalledTimes(1);
    expect(bulkSetItem).toHaveBeenCalledWith([
      { key: ["app", "extensions", "ext1", "remove"], value: "true" },
      { key: ["app", "extensions", "ext2", "remove"], value: "true" },
    ]);
  });

  it("does not mutate the input array", async () => {
    const { wrapped } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");
    const items = [{ key: ["window"], value: "1" }];
    const snapshot: typeof items = JSON.parse(JSON.stringify(items));

    await sub.bulkSetItem(items);

    expect(items).toEqual(snapshot);
  });
});

describe("SubPersistor.bulkRemoveItem", () => {
  it("is exposed when the wrapped persistor exposes it", () => {
    const { wrapped } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");
    expect(typeof sub.bulkRemoveItem).toBe("function");
  });

  it("is undefined when the wrapped persistor does not expose it", () => {
    const sub = new SubPersistor(createWrappedWithoutBulk(), "settings");
    expect(sub.bulkRemoveItem).toBeUndefined();
  });

  it("prepends the hive to every key path", async () => {
    const { wrapped, bulkRemoveItem } = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "app");

    await sub.bulkRemoveItem([["extensions", "a"], ["extensions", "b"]]);

    expect(bulkRemoveItem).toHaveBeenCalledTimes(1);
    expect(bulkRemoveItem).toHaveBeenCalledWith([
      ["app", "extensions", "a"],
      ["app", "extensions", "b"],
    ]);
  });
});

describe("SubPersistor.getAllKVs filtering", () => {
  it("only returns rows that match the hive prefix and strips it", async () => {
    const { wrapped, getAllKVs } = createWrappedWithBulk();
    const mixed: Array<{ key: PersistorKey; value: string }> = [
      { key: ["settings", "window", "x"], value: "1" },
      { key: ["app", "extensions", "ext1"], value: "2" },
      { key: ["settings", "language"], value: "en" },
    ];
    getAllKVs.mockResolvedValue(mixed);

    const sub = new SubPersistor(wrapped, "settings");
    const result = await sub.getAllKVs();

    expect(result).toEqual([
      { key: ["window", "x"], value: "1" },
      { key: ["language"], value: "en" },
    ]);
  });
});
