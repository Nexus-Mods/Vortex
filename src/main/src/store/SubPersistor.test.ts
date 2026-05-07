import type { IPersistor, PersistorKey } from "@vortex/shared/state";

import { describe, it, expect, vi } from "vitest";

import SubPersistor from "./SubPersistor";

function createWrappedWithBulk(): IPersistor {
  return {
    setResetCallback: vi.fn(),
    getItem: vi.fn().mockResolvedValue("value"),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    getAllKVs: vi.fn().mockResolvedValue([]),
    bulkSetItem: vi.fn().mockResolvedValue(undefined),
    bulkRemoveItem: vi.fn().mockResolvedValue(undefined),
  };
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
    const wrapped = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");

    await sub.setItem(["window", "x"], "42");

    expect(wrapped.setItem).toHaveBeenCalledWith(
      ["settings", "window", "x"],
      "42",
    );
  });

  it("removeItem prepends the hive to the key path", async () => {
    const wrapped = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");

    await sub.removeItem(["window", "x"]);

    expect(wrapped.removeItem).toHaveBeenCalledWith([
      "settings",
      "window",
      "x",
    ]);
  });
});

describe("SubPersistor.bulkSetItem", () => {
  it("is exposed when the wrapped persistor exposes it", () => {
    const sub = new SubPersistor(createWrappedWithBulk(), "settings");
    expect(typeof sub.bulkSetItem).toBe("function");
  });

  it("is undefined when the wrapped persistor does not expose it", () => {
    const sub = new SubPersistor(createWrappedWithoutBulk(), "settings");
    expect(sub.bulkSetItem).toBeUndefined();
  });

  it("prepends the hive to every item's key path", async () => {
    const wrapped = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "app");

    await sub.bulkSetItem!([
      { key: ["extensions", "ext1", "remove"], value: "true" },
      { key: ["extensions", "ext2", "remove"], value: "true" },
    ]);

    expect(wrapped.bulkSetItem).toHaveBeenCalledTimes(1);
    expect(wrapped.bulkSetItem).toHaveBeenCalledWith([
      { key: ["app", "extensions", "ext1", "remove"], value: "true" },
      { key: ["app", "extensions", "ext2", "remove"], value: "true" },
    ]);
  });

  it("does not mutate the input array", async () => {
    const wrapped = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "settings");
    const items = [{ key: ["window"], value: "1" }];
    const snapshot: typeof items = JSON.parse(JSON.stringify(items));

    await sub.bulkSetItem!(items);

    expect(items).toEqual(snapshot);
  });
});

describe("SubPersistor.bulkRemoveItem", () => {
  it("is exposed when the wrapped persistor exposes it", () => {
    const sub = new SubPersistor(createWrappedWithBulk(), "settings");
    expect(typeof sub.bulkRemoveItem).toBe("function");
  });

  it("is undefined when the wrapped persistor does not expose it", () => {
    const sub = new SubPersistor(createWrappedWithoutBulk(), "settings");
    expect(sub.bulkRemoveItem).toBeUndefined();
  });

  it("prepends the hive to every key path", async () => {
    const wrapped = createWrappedWithBulk();
    const sub = new SubPersistor(wrapped, "app");

    await sub.bulkRemoveItem!([["extensions", "a"], ["extensions", "b"]]);

    expect(wrapped.bulkRemoveItem).toHaveBeenCalledTimes(1);
    expect(wrapped.bulkRemoveItem).toHaveBeenCalledWith([
      ["app", "extensions", "a"],
      ["app", "extensions", "b"],
    ]);
  });
});

describe("SubPersistor.getAllKVs filtering", () => {
  it("only returns rows that match the hive prefix and strips it", async () => {
    const wrapped = createWrappedWithBulk();
    const mixed: Array<{ key: PersistorKey; value: string }> = [
      { key: ["settings", "window", "x"], value: "1" },
      { key: ["app", "extensions", "ext1"], value: "2" },
      { key: ["settings", "language"], value: "en" },
    ];
    (wrapped.getAllKVs as ReturnType<typeof vi.fn>).mockResolvedValue(mixed);

    const sub = new SubPersistor(wrapped, "settings");
    const result = await sub.getAllKVs!();

    expect(result).toEqual([
      { key: ["window", "x"], value: "1" },
      { key: ["language"], value: "en" },
    ]);
  });
});
