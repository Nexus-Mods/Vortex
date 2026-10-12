import { describe, it, expect } from "vitest";

import { makeRule } from "../../../test-utils/builders";
import type { IModRule } from "../types/IMod";
import {
  rulePhase,
  assignablePhase,
  changeRuleType,
  collectionRulePhases,
  highestRequiredPhase,
  OPTIONAL_PHASE,
} from "./rulePhase";

describe("rulePhase", () => {
  const baseRule = (over: Partial<IModRule>): IModRule => ({
    type: "requires",
    reference: { id: "some-mod" },
    ...over,
  });

  it("reads the first-class rule.phase field", () => {
    expect(rulePhase(baseRule({ phase: 3 }))).toBe(3);
  });

  it("falls back to the legacy rule.extra.phase location", () => {
    // rules persisted before phase became a first-class field stored it under extra;
    // rulePhase is the single place that bridges the two so those rules keep their
    // install ordering without a migration.
    expect(rulePhase(baseRule({ extra: { phase: 2 } }))).toBe(2);
  });

  it("prefers the first-class field over the legacy location", () => {
    expect(rulePhase(baseRule({ phase: 5, extra: { phase: 2 } }))).toBe(5);
  });

  it("defaults to phase 0 when neither location is set", () => {
    expect(rulePhase(baseRule({}))).toBe(0);
  });

  it("treats an explicit phase 0 as set (not a missing value)", () => {
    // phase 0 is the default but also a valid explicit value; the ?? chain must not
    // skip it in favour of the legacy location.
    expect(rulePhase(baseRule({ phase: 0, extra: { phase: 9 } }))).toBe(0);
  });

  it("defaults to 0 for an absent rule rather than throwing", () => {
    // session selectors call this with a possibly-absent rule, so it must degrade to
    // phase 0 rather than dereferencing undefined.
    expect(rulePhase(undefined)).toBe(0);
  });

  it("maps an optional (recommends) rule to OPTIONAL_PHASE, ignoring its authored phase", () => {
    // optionals install in one dedicated phase that sorts after every required phase, so their
    // authored phase is irrelevant.
    expect(rulePhase(baseRule({ type: "recommends", phase: 2 }))).toBe(OPTIONAL_PHASE);
  });
});

describe("collectionRulePhases", () => {
  it("returns the distinct dependency-rule phases, ascending", () => {
    const rules: IModRule[] = [
      { type: "requires", reference: { id: "a" }, phase: 2 },
      { type: "requires", reference: { id: "b" }, phase: 0 },
      { type: "requires", reference: { id: "c" }, phase: 2 },
    ];
    expect(collectionRulePhases(rules)).toEqual([0, 2]);
  });

  it("collapses all optionals into the trailing OPTIONAL_PHASE", () => {
    const rules: IModRule[] = [
      { type: "requires", reference: { id: "a" }, phase: 0 },
      { type: "recommends", reference: { id: "b" }, phase: 1 },
      { type: "recommends", reference: { id: "c" }, phase: 4 },
    ];
    expect(collectionRulePhases(rules)).toEqual([0, OPTIONAL_PHASE]);
  });

  it("ignores non-dependency rules (before/after/conflicts) and tolerates an empty list", () => {
    const rules: IModRule[] = [
      { type: "requires", reference: { id: "a" }, phase: 1 },
      { type: "before", reference: { id: "x" } },
      { type: "conflicts", reference: { id: "y" } },
    ];
    expect(collectionRulePhases(rules)).toEqual([1]);
    expect(collectionRulePhases([])).toEqual([]);
  });
});

describe("highestRequiredPhase", () => {
  it("returns the highest phase among required rules, leaving optionals out", () => {
    const rules = [
      makeRule({ phase: 0 }),
      makeRule({ phase: 2 }),
      makeRule({ type: "recommends" }),
    ];
    expect(highestRequiredPhase(rules)).toBe(2);
  });

  it("returns 0 when every rule is optional", () => {
    expect(highestRequiredPhase([makeRule({ type: "recommends" })])).toBe(0);
  });
});

describe("assignablePhase", () => {
  it("returns the authored phase of a required rule", () => {
    expect(assignablePhase(makeRule({ phase: 2 }))).toBe(2);
  });

  it("has no phase for an optional rule", () => {
    expect(assignablePhase(makeRule({ type: "recommends", phase: 2 }))).toBeUndefined();
  });
});

describe("changeRuleType", () => {
  it("drops the phase of a rule made optional", () => {
    const changed = changeRuleType(makeRule({ phase: 3 }), "recommends");
    expect(changed.type).toBe("recommends");
    expect(changed.phase).toBeUndefined();
  });

  it("puts an optional made required in phase 0, whatever phase it carried", () => {
    const optional = makeRule({ type: "recommends", phase: OPTIONAL_PHASE, extra: { phase: 4 } });
    const changed = changeRuleType(optional, "requires");
    expect(changed.type).toBe("requires");
    expect(rulePhase(changed)).toBe(0);
  });

  it("keeps the phase when the type stays the same", () => {
    const rule = makeRule({ phase: 3 });
    expect(rulePhase(changeRuleType(rule, "requires"))).toBe(3);
  });

  it("keeps the rest of the rule", () => {
    const rule = makeRule({ phase: 3, extra: { author: "someone", phase: 3 } });
    const changed = changeRuleType(rule, "recommends");
    expect(changed.reference).toEqual(rule.reference);
    expect(changed.extra).toEqual({ author: "someone" });
  });
});
