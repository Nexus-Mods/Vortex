/**
 * The precomputed reference identities and ReferenceIndex replace referenceEqual scans on the
 * collection install path, so they must agree with referenceEqual on every JSON-representable
 * reference, including its id-only special case and the way _.pick keeps a key whose value is
 * undefined. These tests check that agreement over many generated references rather than a
 * handful of examples, and through the ADD_MOD_RULE reducer that uses them.
 */
import * as _ from "lodash";
import minimatch from "minimatch";
import { describe, expect, it } from "vitest";

import { modsReducer } from "../reducers/mods";
import type { IModReference, IModRule } from "../types/IMod";
import {
  globMatch,
  identitiesEqual,
  idOnlyRef,
  referenceEqual,
  ReferenceIndex,
  referenceIdentity,
  testRefByIdentifiers,
} from "./testModReference";

/** A small deterministic generator, so a failure reproduces. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/**
 * References drawn from a small value space, so that equal pairs, id-only references,
 * undefined-valued keys (top-level and nested), nulls, arrays, numbers against numeric strings,
 * keys outside the compared fields and differently ordered nested objects are all common.
 */
function makeReferences(count: number, seed: number): IModReference[] {
  const next = random(seed);
  const pick = <T>(values: T[]): T => values[Math.floor(next() * values.length)];
  const set = (target: Record<string, unknown>, key: string, values: unknown[], absent = 0.6) => {
    const roll = next();
    if (roll < absent) {
      return;
    }
    target[key] = roll < absent + 0.1 ? undefined : pick(values);
  };
  const refs: IModReference[] = [];
  for (let i = 0; i < count; i++) {
    const ref: Record<string, unknown> = {};
    if (next() < 0.15) {
      // (nearly) id-only: an id plus fields idOnlyRef ignores, or a key that it does not
      ref.id = pick(["a", "b", "c"]);
      set(ref, "versionMatch", ["1.0.0"]);
      set(ref, "idHint", ["h"]);
      if (next() < 0.3) ref.md5Hint = "m1";
      refs.push(ref as IModReference);
      continue;
    }
    set(ref, "id", ["a", "b", "c"]);
    set(ref, "tag", ["t1", null, ["t1"], ["t1", undefined], ["t1", null], { 0: "t1" }]);
    set(ref, "fileMD5", ["m1", "m2"]);
    set(ref, "logicalFileName", ["L", null]);
    set(ref, "fileExpression", ["E1", "E2"]);
    set(ref, "versionMatch", ["1.0.0", ">=1"]);
    set(ref, "archiveId", ["x"]);
    set(ref, "idHint", ["h"]);
    // not compared, but they stop a reference from being id-only
    if (next() < 0.3) set(ref, "md5Hint", ["m1"], 0);
    if (next() < 0.1) set(ref, "gameId", ["g"], 0);
    if (next() < 0.4) {
      const repo: Record<string, unknown> = {};
      const fields: Array<[string, unknown[]]> = [
        ["repository", ["nexus"]],
        ["modId", ["1", 1, "2"]],
        ["fileId", ["9", 9, null]],
      ];
      for (const [key, values] of next() < 0.5 ? fields : [...fields].reverse()) {
        set(repo, key, values, 0.2);
      }
      ref.repo = repo;
    }
    refs.push(ref as IModReference);
  }
  return refs;
}

/** Nested undefined, e.g. `{ repo: { modId: undefined } }`. */
const hasNestedUndefined = (ref: IModReference) =>
  ref.repo !== undefined && Object.values(ref.repo).includes(undefined);

describe("the generated references", () => {
  it("include every shape the checks below rely on", () => {
    const refs = makeReferences(160, 7);
    let equal = 0;
    let unequal = 0;
    for (const lhs of refs) {
      for (const rhs of refs) {
        if (lhs !== rhs && referenceEqual(lhs, rhs)) equal++;
        else unequal++;
      }
    }
    expect(equal).toBeGreaterThan(100);
    expect(unequal).toBeGreaterThan(100);
    const count = (predicate: (ref: IModReference) => boolean) => refs.filter(predicate).length;
    expect(count((ref) => idOnlyRef(ref))).toBeGreaterThan(3);
    expect(count(hasNestedUndefined)).toBeGreaterThan(3);
    expect(count((ref) => Object.values(ref).includes(null))).toBeGreaterThan(3);
    expect(count((ref) => Array.isArray(ref.tag))).toBeGreaterThan(3);
    expect(count((ref) => typeof ref.repo?.modId === "number")).toBeGreaterThan(3);
    expect(count((ref) => "md5Hint" in ref && ref.id !== undefined)).toBeGreaterThan(3);
  });
});

describe("referenceIdentity", () => {
  const refs = makeReferences(160, 7);

  it("agrees with referenceEqual for every pair", () => {
    for (const lhs of refs) {
      for (const rhs of refs) {
        expect(identitiesEqual(referenceIdentity(lhs), referenceIdentity(rhs))).toBe(
          referenceEqual(lhs, rhs),
        );
      }
    }
  });

  it("with omitUndefined, agrees with referenceEqual on undefined-stripped references", () => {
    const strip = (ref: IModReference) => _.omitBy(ref, _.isUndefined) as IModReference;
    for (const lhs of refs) {
      for (const rhs of refs) {
        expect(
          identitiesEqual(
            referenceIdentity(lhs, { omitUndefined: true }),
            referenceIdentity(rhs, { omitUndefined: true }),
          ),
        ).toBe(referenceEqual(strip(lhs), strip(rhs)));
      }
    }
  });

  it("tells a nested undefined key from an absent one, as _.isEqual does", () => {
    const withKey = { repo: { modId: "1", fileId: undefined } } as IModReference;
    const without = { repo: { modId: "1" } } as IModReference;
    expect(referenceEqual(withKey, without)).toBe(false);
    expect(identitiesEqual(referenceIdentity(withKey), referenceIdentity(without))).toBe(false);
  });

  it("accepts a missing reference, as referenceEqual does", () => {
    const missing = undefined as unknown as IModReference;
    const empty = {} as IModReference;
    expect(identitiesEqual(referenceIdentity(missing), referenceIdentity(empty))).toBe(
      referenceEqual(missing, empty),
    );
  });
});

describe("globMatch", () => {
  it("matches exactly as minimatch does", () => {
    const patterns = [
      "Foo*",
      "Foo v1.0.0",
      "#comment",
      "",
      "*.{esp,esm}",
      "Bundled - [AB]*",
      "a/**",
    ];
    const names = [
      "Foo",
      "Foobar",
      "Foo v1.0.0",
      "#comment",
      "",
      "x.esp",
      "Bundled - Alpha",
      "a/b/c",
    ];
    for (const pattern of patterns) {
      for (const name of names) {
        expect(globMatch(name, pattern)).toBe(minimatch(name, pattern));
        // and again, from the cache
        expect(globMatch(name, pattern)).toBe(minimatch(name, pattern));
      }
    }
  });
});

describe("testRefByIdentifiers", () => {
  // exported to extensions through util/api, and now matching fileExpression with globMatch
  it("matches a fileExpression against archive names as a glob, before and after caching", () => {
    const identifiers = { gameId: "g", fileNames: ["Cool Mod-123-1-0-1700000000.7z"] };
    const matches = (fileExpression: string) =>
      testRefByIdentifiers(identifiers, { fileExpression });
    for (let pass = 0; pass < 2; pass++) {
      expect(matches("Cool Mod-123-*")).toBe(true);
      expect(matches("Cool Mod-123-1-0-1700000000")).toBe(true);
      expect(matches("Cool Mod-12?-1-0-*")).toBe(true);
      expect(matches("Other Mod-*")).toBe(false);
      expect(matches("#Cool Mod-123-*")).toBe(false);
    }
  });
});

describe("ReferenceIndex", () => {
  it("finds what a linear referenceEqual scan finds, for every query", () => {
    for (const seed of [1, 2, 3]) {
      const items = makeReferences(120, seed).map((reference, index) => ({ reference, index }));
      // malformed items with no reference, which a scan must step over
      items.splice(10, 0, { reference: undefined, index: -1 });
      items.splice(60, 0, { reference: undefined, index: -2 });
      const index = new ReferenceIndex(items, (item) => item.reference);
      for (const query of makeReferences(200, seed + 100)) {
        // referenceEqual throws comparing a missing reference with an id-only one; the index
        // treats it as no match instead
        const expected = items.find(
          (item) =>
            !(item.reference === undefined && idOnlyRef(query)) &&
            referenceEqual(item.reference, query),
        );
        expect(index.find(query)).toBe(expected);
      }
    }
  });
});

describe("ADD_MOD_RULE", () => {
  it("replaces or appends exactly where comparing undefined-stripped references did", () => {
    const addRule = modsReducer.reducers.ADD_MOD_RULE;
    const strip = (ref: IModReference) => _.omitBy(ref, _.isUndefined) as IModReference;
    const types = ["requires", "recommends", "before", "after", "conflicts"] as const;
    for (const seed of [11, 12]) {
      let state = { g: { m: { id: "m", rules: [] as IModRule[] } } };
      let replaced = 0;
      makeReferences(150, seed).forEach((reference, i) => {
        const rule: IModRule = { type: types[i % types.length], reference };
        const before = state.g.m.rules;
        // the type check in the reducer matches every rule, so only the reference decides
        const at = before.findIndex((iter) =>
          referenceEqual(strip(rule.reference), strip(iter.reference)),
        );
        state = addRule(state, { gameId: "g", modId: "m", rule }) as typeof state;
        const after = state.g.m.rules;
        expect(after).toHaveLength(at === -1 ? before.length + 1 : before.length);
        expect(after[at === -1 ? before.length : at]).toBe(rule);
        if (at !== -1) replaced++;
      });
      expect(replaced).toBeGreaterThan(10);
      expect(state.g.m.rules.length).toBeGreaterThan(10);
    }
  });

  it("does not re-read the references of the rules already there for each rule added", () => {
    // a collection adds its rules one action at a time, so re-reading every earlier reference
    // per add is quadratic
    const reads = { count: 0 };
    const rules: IModRule[] = Array.from({ length: 50 }, (_unused, i) => ({
      type: "requires",
      reference: countReads({ logicalFileName: `mod-${i}`, versionMatch: "1.0.0" }, reads),
    }));
    let state = { g: { m: { id: "m", rules } } };
    const add = (logicalFileName: string) => {
      const rule: IModRule = { type: "requires", reference: { logicalFileName } };
      state = modsReducer.reducers.ADD_MOD_RULE(state, {
        gameId: "g",
        modId: "m",
        rule,
      }) as typeof state;
    };
    add("new-1");
    const afterFirst = reads.count;
    add("new-2");
    add("new-3");
    expect(reads.count).toBe(afterFirst);
    expect(state.g.m.rules).toHaveLength(53);
  });
});

/** `target`, counting every read of its keys and values into `reads`. */
function countReads<T extends object>(target: T, reads: { count: number }): T {
  const counted =
    <A extends unknown[], R>(trap: (...args: A) => R) =>
    (...args: A): R => {
      reads.count++;
      return trap(...args);
    };
  return new Proxy<T>(target, {
    get: counted(Reflect.get),
    has: counted(Reflect.has),
    ownKeys: counted(Reflect.ownKeys),
    getOwnPropertyDescriptor: counted(Reflect.getOwnPropertyDescriptor),
  });
}
