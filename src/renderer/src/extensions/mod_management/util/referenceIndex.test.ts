/**
 * The precomputed reference identities and ReferenceIndex replace referenceEqual scans on the
 * collection install path, so they must agree with referenceEqual exactly — including its
 * id-only special case and the way _.pick keeps a key whose value is undefined. These tests
 * check that agreement over many generated references rather than a handful of examples.
 */
import * as _ from "lodash";
import minimatch from "minimatch";
import { describe, expect, it } from "vitest";

import type { IModReference } from "../types/IMod";
import {
  globMatch,
  identitiesEqual,
  referenceEqual,
  ReferenceIndex,
  referenceIdentity,
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
 * undefined-valued keys and differently ordered nested objects are all common.
 */
function makeReferences(count: number, seed: number): IModReference[] {
  const next = random(seed);
  const pick = <T>(values: T[]): T => values[Math.floor(next() * values.length)];
  const refs: IModReference[] = [];
  for (let i = 0; i < count; i++) {
    const ref: Record<string, unknown> = {};
    const set = (key: string, values: unknown[]) => {
      const roll = next();
      if (roll < 0.45) {
        return; // absent
      }
      ref[key] = roll < 0.55 ? undefined : pick(values);
    };
    set("id", ["a", "b", "c"]);
    set("tag", ["t1", "t2"]);
    set("fileMD5", ["m1", "m2"]);
    set("logicalFileName", ["L"]);
    set("fileExpression", ["E1", "E2"]);
    set("versionMatch", ["1.0.0", ">=1"]);
    set("archiveId", ["x"]);
    set("idHint", ["h"]);
    if (next() < 0.3) {
      ref.repo =
        next() < 0.5
          ? { repository: "nexus", modId: pick(["1", "2"]), fileId: "9" }
          : { fileId: "9", modId: pick(["1", "2"]), repository: "nexus" };
    }
    refs.push(ref as IModReference);
  }
  return refs;
}

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

  it("accepts a missing reference, as referenceEqual does", () => {
    const missing = undefined as unknown as IModReference;
    const empty = {} as IModReference;
    expect(identitiesEqual(referenceIdentity(missing), referenceIdentity(empty))).toBe(
      referenceEqual(missing, empty),
    );
  });
});

describe("the generated references", () => {
  it("include equal pairs, unequal pairs and id-only references, so the checks above bite", () => {
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
    expect(refs.filter((ref) => referenceIdentity(ref).idOnly).length).toBeGreaterThan(3);
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

describe("ReferenceIndex", () => {
  it("finds what a linear referenceEqual scan finds, for every query", () => {
    for (const seed of [1, 2, 3]) {
      const items = makeReferences(120, seed).map((reference, index) => ({ reference, index }));
      const index = new ReferenceIndex(items, (item) => item.reference);
      for (const query of makeReferences(200, seed + 100)) {
        expect(index.find(query)).toBe(items.find((item) => referenceEqual(item.reference, query)));
      }
    }
  });
});
