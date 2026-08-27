/**
 * Unit coverage for selectedOptionalRules - the pure filter that decides which optional (recommends)
 * members still need installing when the trailing optional phase runs. Kept in dependencies.ts next
 * to gatherDependencies/findModByRef; tested here without the InstallManager orchestration.
 *
 * Also covers gatherDependencies' session addressing: the install session tracks the collection's
 * OWN rules, so only a top-level node carries its rule's session key. A transitive sub-dependency
 * is not a member, and an addressed write for it would warn "matched no member" on every lifecycle
 * event.
 */
import { describe, expect, vi } from "vitest";

import { makeMod, makeReference, makeRule } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import { modRuleId } from "../../../util/collectionInstallSession";
import type { IMod } from "../types/IMod";
import gatherDependencies, { selectedOptionalRules } from "./dependencies";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));

describe("selectedOptionalRules", () => {
  test("returns only selected (non-ignored) optional members that are not yet installed", () => {
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

  test("treats an explicit ignored:false as selected", () => {
    const rules = [makeRule({ type: "recommends", reference: { tag: "opt" }, ignored: false })];
    expect(selectedOptionalRules(rules, {}).map((r) => r.reference.tag)).toEqual(["opt"]);
  });

  test("tolerates an empty / undefined rule list", () => {
    expect(selectedOptionalRules([], {})).toEqual([]);
    expect(selectedOptionalRules(undefined as unknown as [], {})).toEqual([]);
  });
});

describe("gatherDependencies", () => {
  test("keys only the collection's own rules for session writes", async ({ makeApi }) => {
    const subRule = makeRule({ type: "requires", reference: makeReference({ tag: "sub-tag" }) });
    const memberRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "member-tag" }),
      extra: { rules: [subRule] },
    });
    const h = makeApi();
    const api = Object.assign(h.api, {
      lookupModReference: vi.fn().mockResolvedValue([]),
      lookupModMeta: vi.fn().mockResolvedValue([]),
    });

    const deps = await gatherDependencies([memberRule], api, false);

    const member = deps.find((dep) => dep.reference.tag === "member-tag");
    const sub = deps.find((dep) => dep.reference.tag === "sub-tag");
    expect(member?.sessionRuleId).toBe(modRuleId(memberRule));
    expect(sub).toBeDefined();
    expect(sub?.sessionRuleId).toBeUndefined();
  });
});
