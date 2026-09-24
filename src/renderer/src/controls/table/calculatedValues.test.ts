import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ITableAttribute } from "../../types/ITableAttribute";
import SuperTable from "../Table";

// How many cached rows immutability-helper copied. Copying the whole cache once per changed
// row makes an update that touches every row quadratic.
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

// Without the redux, extension and translation wrappers the default export is SuperTable
// itself, so its update can be driven directly. vi.mock is hoisted above the imports.
vi.mock("../ComponentEx", async (importOriginal) => {
  const actual = await importOriginal<object>();
  const unwrapped = () => (component: unknown) => component;
  return { ...actual, connect: unwrapped, extend: unwrapped, translate: unwrapped };
});

interface IPlugin {
  index: number | undefined;
}

const indexAttribute: ITableAttribute<IPlugin> = {
  id: "index",
  placement: "detail",
  calc: (plugin) => plugin.index,
  edit: {},
};

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
    objects: [indexAttribute],
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
    expect(instance.state.calculatedValues.added).toEqual({ __id: "added", index: 3 });
    expect(instance.setState).toHaveBeenCalled();
  });

  it("removes rows without modifying the values in its state", async () => {
    const data = plugins(3);
    const instance = await table(data);
    const prev = instance.state.calculatedValues;
    const { plugin2: _removed, ...remaining } = data;

    await instance.updateCalculatedValues(props(remaining));

    expect(Object.keys(prev)).toEqual(["plugin0", "plugin1", "plugin2"]);
    expect(Object.keys(instance.state.calculatedValues)).toEqual(["plugin0", "plugin1"]);
    expect(instance.setState).toHaveBeenCalled();
  });

  it("keeps its values when nothing changed", async () => {
    const data = plugins(3);
    const instance = await table(data);
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props({ ...data, plugin1: { index: 1 } }));

    expect(instance.state.calculatedValues).toBe(prev);
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it("applies an update requested during another once that one finishes", async () => {
    const instance = await table(plugins(3));

    const first = instance.updateCalculatedValues(props(plugins(3, 10)));
    await instance.updateCalculatedValues(props(plugins(2, 20)));
    await first;

    expect(instance.state.calculatedValues).toEqual({
      plugin0: { __id: "plugin0", index: 20 },
      plugin1: { __id: "plugin1", index: 21 },
    });
  });

  it("copies its values once per update, not once per changed row", async () => {
    const count = 200;
    const instance = await table(plugins(count));
    const prev = instance.state.calculatedValues;

    await instance.updateCalculatedValues(props(plugins(count, 1)));

    expect(instance.state.calculatedValues.plugin0).toEqual({ __id: "plugin0", index: 1 });
    expect(prev.plugin0).toEqual({ __id: "plugin0", index: 0 });
    expect(copies.cachedRows).toBeLessThanOrEqual(count);
  });
});
