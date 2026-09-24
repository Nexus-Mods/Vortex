import { performance } from "node:perf_hooks";

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

function rows(count: number, offset: number): ILookupCalculated {
  const result: ILookupCalculated = {};
  for (let i = 0; i < count; i++) {
    result[`row${i}`] = { __id: `row${i}`, index: i + offset };
  }
  return result;
}

function fastestMs(merge: () => unknown): number {
  let fastest = Infinity;
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    merge();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
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

  it("returns the previous values when every delta repeats them", () => {
    const prev = frozen({ ...cache(), c: { __id: "c", name: null } });

    const next = mergeCalculated(
      prev,
      { a: { __id: "a", index: 0 }, c: { __id: "c", name: null, missing: undefined } },
      [],
    );

    expect(next).toBe(prev);
  });

  it("keeps the object of a row whose delta repeats its values", () => {
    const prev = frozen({ ...cache(), c: { __id: "c", name: null } });

    const next = mergeCalculated(
      prev,
      { a: { __id: "a", index: 5 }, c: { __id: "c", name: null } },
      [],
    );

    expect(next.a).toEqual({ __id: "a", name: "A", index: 5 });
    expect(next.b).toBe(prev.b);
    expect(next.c).toBe(prev.c);
  });

  it.each([
    [null, 1],
    [1, null],
    [null, undefined],
    [undefined, null],
  ])("treats %s becoming %s as a change", (before, after) => {
    const prev = frozen({ ...cache(), c: { __id: "c", name: before } });

    const next = mergeCalculated(prev, { c: { __id: "c", name: after } }, []);

    expect(next.c).not.toBe(prev.c);
    expect(next.c).toEqual({ __id: "c", name: after });
    expect(next.a).toBe(prev.a);
  });

  // A copy of the whole cache per changed row makes an update that changes every row, such as
  // toggling a plugin, quadratic. Object spread can't be counted: a Proxy on `prev` sees only the
  // first copy, because every later one is made from the plain object that copy returned. So
  // this compares times instead. Changing every row should cost a small multiple of changing
  // one, which also copies the whole cache once; comparing the two leaves out the machine's
  // speed, and taking the fastest of several runs leaves out collection pauses. The cache has more
  // rows than V8 keeps as fast properties, so the copies of it cost about as much as the first
  // copy; a smaller one's copies are much cheaper than the first, which hides most of the extra
  // work.
  it("changes every row in linear time, not with a copy of the cache per row", () => {
    const count = 2000;
    const prev = frozen(rows(count, 0));
    const everyRow = rows(count, 1);
    const oneRow = { row0: everyRow.row0 };

    const everyRowMs = fastestMs(() => mergeCalculated(prev, everyRow, []));
    const oneRowMs = fastestMs(() => mergeCalculated(prev, oneRow, []));

    expect(mergeCalculated(prev, everyRow, [])).toEqual(everyRow);
    expect(everyRowMs).toBeLessThan(oneRowMs * 20);
  });

  it("keeps a row's values that the delta does not recalculate", () => {
    const prev = frozen(cache());

    const next = mergeCalculated(prev, { b: { __id: "b", index: 9 } }, ["a"]);

    expect(next).toEqual({ b: { __id: "b", name: "B", index: 9 } });
  });
});
