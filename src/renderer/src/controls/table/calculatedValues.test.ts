import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ITableAttribute } from "../../types/ITableAttribute";
import SuperTable from "../Table";
import type * as MergeCalculated from "./mergeCalculated";

// How many cached rows were copied, through either way the table copies its cache:
// immutability-helper or mergeCalculated. Copying the whole cache once per changed row makes
// an update that touches every row quadratic. A Proxy on the cache would only see the first
// copy, because every later copy is made from a plain object the table created itself.
const copies = vi.hoisted(() => ({ cachedRows: 0 }));

vi.mock("immutability-helper", async (importOriginal) => {
  const actual = await importOriginal<{ default: (target: any, spec: any) => any }>();
  const isCache = (target: unknown) =>
    typeof target === "object" &&
    target !== null &&
    Object.values(target).some((row) => row?.__id !== undefined);
  const counted = (target: any, spec: any) => {
    if (isCache(target)) {
      copies.cachedRows += Object.keys(target).length;
    }
    return actual.default(target, spec);
  };
  return { ...actual, default: counted };
});

// Counts one copy per call that changes anything. That a call copies only once, however many rows
// change, is checked in mergeCalculated.test.ts.
vi.mock("./mergeCalculated", async (importOriginal) => {
  const actual = await importOriginal<typeof MergeCalculated>();
  const counted: typeof actual.mergeCalculated = (prev, deltas, removedIds) => {
    const next = actual.mergeCalculated(prev, deltas, removedIds);
    if (next !== prev) {
      copies.cachedRows += Object.keys(prev).length;
    }
    return next;
  };
  return { ...actual, mergeCalculated: counted };
});

// Without the redux, extension and translation wrappers the default export is SuperTable
// itself, so its update can be driven directly. vi.mock is hoisted above the imports.
vi.mock("../ComponentEx", async (importOriginal) => {
  const actual = await importOriginal<object>();
  const unwrapped = () => (component: unknown) => component;
  return { ...actual, connect: unwrapped, extend: unwrapped, translate: unwrapped };
});

interface IPlugin {
  index: number | null | undefined;
}

const indexAttribute: ITableAttribute<IPlugin> = {
  id: "index",
  placement: "detail",
  calc: (plugin) => plugin.index,
  edit: {},
};

// Like the Mods page's category column, which is null for every uncategorised mod
const nullAttribute: ITableAttribute<IPlugin> = {
  id: "category",
  placement: "detail",
  calc: () => null,
  edit: {},
};

// New row objects on every call, so every row is recalculated, as when a page rebuilds its rows
function plugins(count: number, offset = 0): Record<string, IPlugin> {
  const result: Record<string, IPlugin> = {};
  for (let i = 0; i < count; i++) {
    result[`plugin${i}`] = { index: i + offset };
  }
  return result;
}

function props(data: Record<string, IPlugin>) {
  return {
    t: (key: string) => key,
    tableId: "test",
    data,
    objects: [indexAttribute, nullAttribute],
    actions: [],
    attributeState: {},
    language: "en",
  };
}

// An unmounted table whose setState commits synchronously, with its first pass finished.
async function table(data: Record<string, IPlugin>) {
  const instance: any = new (SuperTable as any)(props(data));
  instance.mMounted = true;
  instance.setState = vi.fn((state, callback) => {
    instance.state = state;
    callback?.();
  });
  await vi.waitFor(() => expect(instance.mUpdateInProgress).toBe(false));
  instance.setState.mockClear();
  return instance;
}

function expectSameRows(next: object, prev: object, rowIds: string[]) {
  rowIds.forEach((rowId) => expect(next[rowId], rowId).toBe(prev[rowId]));
}

describe("SuperTable calculated values", () => {
  beforeEach(() => {
    copies.cachedRows = 0;
  });

  it("adds rows without modifying the values in its state", async () => {
    const data = plugins(3);
    const instance = await table(data);
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props({ ...data, added: { index: 3 } }));

    expect(Object.keys(prev)).toEqual(["plugin0", "plugin1", "plugin2"]);
    expect(instance.state.calculatedValues).not.toBe(prev);
    expect(instance.state.calculatedValues.added).toEqual({
      __id: "added",
      index: 3,
      category: null,
    });
  });

  it("removes rows without modifying the values in its state", async () => {
    const data = plugins(3);
    const instance = await table(data);
    const prev = instance.state.calculatedValues;
    const { plugin2: _removed, ...remaining } = data;

    await instance.updateCalculatedValues(props(remaining));

    expect(Object.keys(prev)).toEqual(["plugin0", "plugin1", "plugin2"]);
    expect(Object.keys(instance.state.calculatedValues)).toEqual(["plugin0", "plugin1"]);
  });

  it("keeps its values when nothing changed", async () => {
    const data = plugins(3);
    const instance = await table(data);
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props({ ...data, plugin1: { index: 1 } }));

    expect(instance.state.calculatedValues).toBe(prev);
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it("keeps every other row's object when a row is added and a column is null", async () => {
    const instance = await table(plugins(3));
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props({ ...plugins(3), added: { index: 3 } }));

    expectSameRows(instance.state.calculatedValues, prev, ["plugin0", "plugin1", "plugin2"]);
    expect(instance.state.calculatedValues.added.category).toBeNull();
  });

  it("gives only the row whose value changed a new object", async () => {
    const instance = await table(plugins(3));
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props({ ...plugins(3), plugin1: { index: 7 } }));

    expect(instance.state.calculatedValues.plugin1).not.toBe(prev.plugin1);
    expect(instance.state.calculatedValues.plugin1.index).toBe(7);
    expectSameRows(instance.state.calculatedValues, prev, ["plugin0", "plugin2"]);
  });

  it.each([
    ["null", "a number", null, 5],
    ["a number", "null", 5, null],
    ["null", "undefined", null, undefined],
    ["undefined", "null", undefined, null],
  ])("treats %s becoming %s as a change", async (_from, _to, before, after) => {
    const instance = await table({ ...plugins(2), subject: { index: before } });
    const prev = instance.state.calculatedValues;

    const changed = await instance.updateCalculatedValues(
      props({ ...plugins(2), subject: { index: after } }),
    );

    expect(instance.state.calculatedValues.subject).not.toBe(prev.subject);
    expect(instance.state.calculatedValues.subject.index).toBe(after);
    expect(changed).toEqual(["index"]);
    expectSameRows(instance.state.calculatedValues, prev, ["plugin0", "plugin1"]);
  });

  it("applies an update requested during another once that one finishes", async () => {
    const instance = await table(plugins(3));

    const first = instance.updateCalculatedValues(props(plugins(3, 10)));
    await instance.updateCalculatedValues(props(plugins(2, 20)));
    await first;

    expect(instance.state.calculatedValues).toEqual({
      plugin0: { __id: "plugin0", index: 20, category: null },
      plugin1: { __id: "plugin1", index: 21, category: null },
    });
  });

  it("copies its values once per update, not once per changed row", async () => {
    const count = 200;
    const instance = await table(plugins(count));
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props(plugins(count, 1)));

    expect(instance.state.calculatedValues.plugin0).toEqual({
      __id: "plugin0",
      index: 1,
      category: null,
    });
    expect(prev.plugin0).toEqual({ __id: "plugin0", index: 0, category: null });
    expect(copies.cachedRows).toBeLessThanOrEqual(count);
  });
});
