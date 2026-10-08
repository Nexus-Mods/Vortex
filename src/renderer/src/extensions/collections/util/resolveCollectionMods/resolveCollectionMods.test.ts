import { describe, expect, it, vi } from "vitest";

import { makeMod, makeRule } from "../../../../test-utils/builders";
import { modRuleId } from "../../../../util/collectionInstallSession";
import type { IMod, IModRule } from "../../../mod_management/types/IMod";
import { makeCollectionModsResolver, resolveCollectionMods } from "./resolveCollectionMods";

vi.mock("../../../../util/log", () => ({ log: vi.fn() }));

// a requires-rule referencing "mod-1" by id, and an installed mod
const requiresRule = (over: Partial<IModRule> = {}): IModRule =>
  makeRule({ reference: { id: "mod-1", description: "Mod One" }, ...over });

const installedMod = (id: string): IMod =>
  makeMod({ id, installationPath: `mods/${id}`, attributes: { name: id } });

describe("resolveCollectionMods", () => {
  it("maps each installed dependency rule to its mod and leaves the rest out", () => {
    const installed = requiresRule({ reference: { id: "mod-1" } });
    const missing = makeRule({ reference: { id: "mod-2" } });
    const ordering: IModRule = { type: "before", reference: { id: "mod-1" } };

    const resolved = resolveCollectionMods([installed, missing, ordering], {
      "mod-1": installedMod("mod-1"),
    });

    expect([...resolved.byRule.keys()]).toEqual([modRuleId(installed)]);
    expect(resolved.byRule.get(modRuleId(installed))?.id).toBe("mod-1");
  });

  it("resolves a member installed since the previous result", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const rules = [rule];
    const first = resolveCollectionMods(rules, {});

    const second = resolveCollectionMods(rules, { "mod-1": installedMod("mod-1") }, first);

    expect(second.byRule.get(modRuleId(rule))?.id).toBe("mod-1");
  });

  it("retests an unresolved member only against mods changed since the previous result", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const rules = [rule];
    const mods = { "mod-1": installedMod("mod-1") };
    // a previous result that (wrongly) left the member unresolved against these same mods
    const previous = { rules, mods, byRule: new Map<string, IMod>() };

    const resolved = resolveCollectionMods(rules, mods, previous);

    // mod-1 is unchanged, so it is not scanned again
    expect(resolved.byRule.has(modRuleId(rule))).toBe(false);
  });

  it("drops a member whose matched mod was removed", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const rules = [rule];
    const first = resolveCollectionMods(rules, { "mod-1": installedMod("mod-1") });

    const second = resolveCollectionMods(rules, {}, first);

    expect(second.byRule.has(modRuleId(rule))).toBe(false);
  });

  it("resolves from scratch when the rules changed", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const mods = { "mod-1": installedMod("mod-1") };
    const previous = { rules: [rule], mods, byRule: new Map<string, IMod>() };

    const resolved = resolveCollectionMods([rule], mods, previous);

    expect(resolved.byRule.get(modRuleId(rule))?.id).toBe("mod-1");
  });
});

describe("makeCollectionModsResolver", () => {
  it("hands back the same result while neither the rules nor the mods changed", () => {
    const resolve = makeCollectionModsResolver();
    const rules = [requiresRule()];
    const mods = { "mod-1": installedMod("mod-1") };

    expect(resolve(rules, mods)).toBe(resolve(rules, mods));
  });

  it("resolves each collection against its own previous result", () => {
    const resolve = makeCollectionModsResolver();
    const rulesA = [requiresRule()];
    const rulesB = [makeRule({ reference: { id: "mod-2" } })];
    resolve(rulesA, {});
    resolve(rulesB, {});

    const mods = { "mod-1": installedMod("mod-1"), "mod-2": installedMod("mod-2") };

    expect(resolve(rulesA, mods).byRule.get(modRuleId(rulesA[0]))?.id).toBe("mod-1");
    expect(resolve(rulesB, mods).byRule.get(modRuleId(rulesB[0]))?.id).toBe("mod-2");
  });

  it("treats missing rules as an empty collection", () => {
    const resolve = makeCollectionModsResolver();

    expect(resolve(undefined, { "mod-1": installedMod("mod-1") }).byRule.size).toBe(0);
  });
});
