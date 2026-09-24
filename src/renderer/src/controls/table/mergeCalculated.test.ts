import { describe, expect, it } from "vitest";

import type { ILookupCalculated } from "../Table";
import { mergeCalculated } from "./mergeCalculated";

function cache(): ILookupCalculated {
  return {
    a: { __id: "a", name: "A", index: 0 },
    b: { __id: "b", name: "B", index: 1 },
  };
}

function frozen(values: ILookupCalculated): ILookupCalculated {
  Object.values(values).forEach((row) => Object.freeze(row));
  return Object.freeze(values);
}

describe("mergeCalculated", () => {
  it("returns the previous values when nothing changed", () => {
    const prev = frozen(cache());
    expect(mergeCalculated(prev, {}, [])).toBe(prev);
  });

  it("returns the previous values when the removed rows had no values", () => {
    const prev = frozen(cache());
    expect(mergeCalculated(prev, {}, ["never-calculated"])).toBe(prev);
  });

  it("adds new rows without modifying the previous values", () => {
    const prev = frozen(cache());
    const added = { __id: "c", name: "C", index: 2 };

    const next = mergeCalculated(prev, { c: added }, []);

    expect(next).toEqual({ ...cache(), c: added });
    expect(next.c).toBe(added);
    expect(prev).toEqual(cache());
  });

  it("removes rows without modifying the previous values", () => {
    const prev = frozen(cache());

    const next = mergeCalculated(prev, {}, ["a"]);

    expect(next).toEqual({ b: cache().b });
    expect(prev).toEqual(cache());
  });

  it("gives changed rows a new object and keeps every other row's", () => {
    const prev = frozen(cache());

    const next = mergeCalculated(prev, { a: { __id: "a", index: 5, name: undefined } }, []);

    expect(next.a).not.toBe(prev.a);
    expect(next.a).toEqual({ __id: "a", name: undefined, index: 5 });
    expect(next.b).toBe(prev.b);
    expect(prev).toEqual(cache());
  });

  it("keeps a row's values that the delta does not recalculate", () => {
    const prev = frozen(cache());

    const next = mergeCalculated(prev, { b: { __id: "b", index: 9 } }, ["a"]);

    expect(next).toEqual({ b: { __id: "b", name: "B", index: 9 } });
  });
});
