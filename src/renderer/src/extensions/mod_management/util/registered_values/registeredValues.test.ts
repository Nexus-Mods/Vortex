import { describe, expect, it, vi } from "vitest";

import type { ITableAttribute } from "@/types/ITableAttribute";
import type { TFunction } from "@/util/i18n";

import type { IModWithState } from "../../types/IModProps";
import { type ModsById, RegisteredValues } from "./registeredValues";

// --- Helpers ---

const t = ((key: string) => key) as unknown as TFunction;

const attribute = (attr: Partial<ITableAttribute<IModWithState>>): ITableAttribute =>
  ({ id: "extra", name: "Extra", placement: "table", edit: {}, ...attr }) as ITableAttribute;

const mod = (id = "a", extra: object = {}) => ({ id, ...extra }) as unknown as IModWithState;

const NO_MODS: ModsById = {};

// --- Tests ---

describe("RegisteredValues", () => {
  it("works a mod's value out once, until the mod changes", () => {
    const calc = vi.fn((m: IModWithState) => m.attributes?.endorsed);
    const values = new RegisteredValues(t);
    const endorsed = attribute({ calc });
    const before = mod("a", { attributes: { endorsed: "Undecided" } });

    expect(values.get(endorsed, before, NO_MODS).value).toBe("Undecided");
    expect(values.get(endorsed, before, NO_MODS).value).toBe("Undecided");
    expect(calc).toHaveBeenCalledTimes(1);

    const after = mod("a", { attributes: { endorsed: "Endorsed" } });
    expect(values.get(endorsed, after, NO_MODS).value).toBe("Endorsed");
    expect(calc).toHaveBeenCalledTimes(2);
  });

  it("works a value out again once its data outside the mods has changed", () => {
    let order = 1;
    const values = new RegisteredValues(t);
    const loadOrder = attribute({ id: "loadOrder", calc: () => order });
    const a = mod();
    values.get(loadOrder, a, NO_MODS);

    order = 2;
    expect(values.get(loadOrder, a, NO_MODS).value).toBe(1);

    values.invalidate("loadOrder");
    expect(values.get(loadOrder, a, NO_MODS).value).toBe(2);
  });

  it("works a volatile value out again when any mod changes, and others only for their own", () => {
    let count = 1;
    const values = new RegisteredValues(t);
    const volatile = attribute({ id: "volatile", isVolatile: true, calc: () => count });
    const plain = attribute({ id: "plain", calc: () => count });
    const a = mod();
    values.get(volatile, a, NO_MODS);
    values.get(plain, a, NO_MODS);

    count = 2;
    const mods = { b: mod("b") };

    expect(values.get(volatile, a, mods).value).toBe(2);
    expect(values.get(plain, a, mods).value).toBe(1);
  });

  it("keeps the last value while a new one is worked out asynchronously", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const values = new RegisteredValues(t);
    const compat = attribute({
      calc: () => new Promise<string>((resolve) => resolvers.push(resolve)),
    });

    const first = values.get(compat, mod(), NO_MODS);
    expect(first.value).toBeUndefined();
    resolvers[0]("Compatible");
    await first.pending;
    expect(first).toMatchObject({ value: "Compatible", pending: undefined });

    const second = values.get(compat, mod(), NO_MODS);
    expect(second.value).toBe("Compatible");
    resolvers[1]("Incompatible");
    await second.pending;
    expect(second.value).toBe("Incompatible");
  });

  it("gives nothing for a value that fails to be worked out, at once or asynchronously", async () => {
    const values = new RegisteredValues(t);
    const throws = attribute({
      id: "throws",
      calc: () => {
        throw new Error("broken");
      },
    });
    const rejects = attribute({ id: "rejects", calc: () => Promise.reject(new Error("broken")) });

    expect(values.get(throws, mod(), NO_MODS).value).toBeUndefined();

    const rejected = values.get(rejects, mod(), NO_MODS);
    await rejected.pending;
    expect(rejected).toMatchObject({ value: undefined, pending: undefined });
  });

  it("gives a search the value as last worked out, working it out if it hasn't been", () => {
    const calc = vi.fn(() => "Textures");
    const values = new RegisteredValues(t);
    const content = attribute({ isVolatile: true, calc });
    const a = mod();

    expect(values.forSearch(content, a).value).toBe("Textures");
    values.get(content, a, NO_MODS);
    expect(values.forSearch(content, a).value).toBe("Textures");
    expect(calc).toHaveBeenCalledTimes(2);
  });
});
