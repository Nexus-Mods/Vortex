/**
 * Unit coverage for selectedOptionalRules - the pure filter that decides which optional (recommends)
 * members still need installing when the trailing optional phase runs. Kept in dependencies.ts next
 * to gatherDependencies/findModByRef; tested here without the InstallManager orchestration.
 */
import { describe, expect, it, vi } from "vitest";

import { makeMod, makeRule } from "../../../test-utils/builders";
import type { IMod } from "../types/IMod";
import { selectedOptionalRules } from "./dependencies";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));

describe("selectedOptionalRules", () => {
  it("returns only selected (non-ignored) optional members that are not yet installed", () => {
    const rules = [
      makeRule({ type: "recommends", reference: { tag: "opt-selected" } }),
      makeRule({ type: "recommends", reference: { tag: "opt-skipped" }, ignored: true }),
      makeRule({ type: "requires", reference: { tag: "req" } }),
      makeRule({ type: "recommends", reference: { tag: "opt-installed" } }),
    ];
    // an installed mod carrying the "opt-installed" reference tag - that member is already done
    const mods: Record<string, IMod> = {
      m1: makeMod({ id: "m1", attributes: { referenceTag: "opt-installed" } }),
    };

    const result = selectedOptionalRules(rules, mods);
    expect(result.map((r) => r.reference.tag)).toEqual(["opt-selected"]);
  });

  it("treats an explicit ignored:false as selected", () => {
    const rules = [makeRule({ type: "recommends", reference: { tag: "opt" }, ignored: false })];
    expect(selectedOptionalRules(rules, {}).map((r) => r.reference.tag)).toEqual(["opt"]);
  });

  it("tolerates an empty / undefined rule list", () => {
    expect(selectedOptionalRules([], {})).toEqual([]);
    expect(selectedOptionalRules(undefined as unknown as [], {})).toEqual([]);
  });
});
