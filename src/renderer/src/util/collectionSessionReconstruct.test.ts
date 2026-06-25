/**
 * Unit coverage for the session reconstruction helpers: building a session's per-rule
 * info from reality (reconstructSessionMods) and diffing the live session against it
 * (planSessionResync). The dispatching orchestrator resyncCollectionSessionFromReality is
 * thin wiring over these two and is exercised in-app / at the driver-seam layer.
 */
import { describe, expect, it } from "vitest";

import type { IMod, IModRule } from "../extensions/mod_management/types/IMod";
import { makeMod, makeModInstallInfo, makeRule } from "../test-utils/builders";
import type { ICollectionModInstallInfo } from "../types/collections/ICollectionInstallSession";
import { modRuleId } from "./collectionInstallSession";
import { planSessionResync, reconstructSessionMods } from "./collectionSessionReconstruct";

// a requires-rule referencing a mod by id, matched the same way itemRows tests do
const requiresRule = (over: Partial<IModRule> = {}): IModRule =>
  makeRule({ reference: { id: "mod-1" }, ...over });

// an installed mod whose attributes.name defaults to its id (so findModByRef matches)
const installedMod = (id: string, over: Partial<IMod> = {}): IMod =>
  makeMod({ id, installationPath: `mods/${id}`, attributes: { name: id }, ...over });

describe("reconstructSessionMods", () => {
  it("derives an installed mod: status installed, modId set to the matched mod", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const result = reconstructSessionMods({
      rules: [rule],
      mods: { "mod-1": installedMod("mod-1") },
      downloads: {},
    });

    const info = result[modRuleId(rule)];
    expect(info.status).toBe("installed");
    expect(info.modId).toBe("mod-1");
    expect(info.type).toBe("requires");
  });

  it("reports an in-progress mod's own lifecycle state and records no modId until installed", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const result = reconstructSessionMods({
      rules: [rule],
      mods: { "mod-1": installedMod("mod-1", { state: "installing" }) },
      downloads: {},
    });

    const info = result[modRuleId(rule)];
    expect(info.status).toBe("installing");
    // modId is recorded only for the installed status (per the type contract)
    expect(info.modId).toBeUndefined();
  });

  it("treats an ignored rule as ignored regardless of an installed copy", () => {
    const rule = requiresRule({ reference: { id: "mod-1" }, ignored: true });
    const result = reconstructSessionMods({
      rules: [rule],
      mods: { "mod-1": installedMod("mod-1") },
      downloads: {},
    });

    const info = result[modRuleId(rule)];
    expect(info.status).toBe("ignored");
    // ignored wins before a mod is consulted, so no modId is recorded
    expect(info.modId).toBeUndefined();
  });

  it("falls back to pending with no modId when nothing matches", () => {
    const rule = requiresRule({ reference: { id: "absent" } });
    const result = reconstructSessionMods({ rules: [rule], mods: {}, downloads: {} });

    const info = result[modRuleId(rule)];
    expect(info.status).toBe("pending");
    expect(info.modId).toBeUndefined();
  });

  it("ignores rules that are not requires/recommends", () => {
    const result = reconstructSessionMods({
      rules: [requiresRule(), { type: "before", reference: { id: "x" } }],
      mods: {},
      downloads: {},
    });

    expect(Object.keys(result)).toEqual([modRuleId(requiresRule())]);
  });
});

describe("planSessionResync", () => {
  // build a current/reconstructed mods map keyed by ruleId from compact entries
  const mods = (
    entries: Record<string, Partial<ICollectionModInstallInfo>>,
  ): Record<string, ICollectionModInstallInfo> =>
    Object.fromEntries(Object.entries(entries).map(([id, info]) => [id, makeModInstallInfo(info)]));

  it("returns nothing when every entry already matches reality", () => {
    const current = mods({ r1: { status: "installed", modId: "m1" }, r2: { status: "pending" } });
    const reconstructed = mods({
      r1: { status: "installed", modId: "m1" },
      r2: { status: "pending" },
    });

    expect(planSessionResync(current, reconstructed)).toEqual([]);
  });

  it("emits a status write when an entry's status drifted", () => {
    const current = mods({ r1: { status: "installing" } });
    const reconstructed = mods({ r1: { status: "pending" } });

    expect(planSessionResync(current, reconstructed)).toEqual([
      { ruleId: "r1", status: "pending" },
    ]);
  });

  it("emits a markInstalled write (carrying modId) when reality is installed", () => {
    const current = mods({ r1: { status: "downloading" } });
    const reconstructed = mods({ r1: { status: "installed", modId: "m1" } });

    expect(planSessionResync(current, reconstructed)).toEqual([
      { ruleId: "r1", status: "installed", modId: "m1" },
    ]);
  });

  it("treats a changed modId on an already-installed entry as drift", () => {
    const current = mods({ r1: { status: "installed", modId: "old" } });
    const reconstructed = mods({ r1: { status: "installed", modId: "new" } });

    expect(planSessionResync(current, reconstructed)).toEqual([
      { ruleId: "r1", status: "installed", modId: "new" },
    ]);
  });

  it("does not re-write an installed entry whose modId still matches", () => {
    const current = mods({ r1: { status: "installed", modId: "m1" } });
    const reconstructed = mods({ r1: { status: "installed", modId: "m1" } });

    expect(planSessionResync(current, reconstructed)).toEqual([]);
  });

  it("moves an entry off a protected state when reality no longer agrees", () => {
    // resync overrides protection: an installed mod the user removed out of band must be
    // allowed to revert (planSessionWrite would have blocked this; resync deliberately does not)
    const current = mods({ r1: { status: "installed", modId: "m1" } });
    const reconstructed = mods({ r1: { status: "pending" } });

    expect(planSessionResync(current, reconstructed)).toEqual([
      { ruleId: "r1", status: "pending" },
    ]);
  });

  it("leaves session entries with no reconstruction counterpart untouched", () => {
    const current = mods({ r1: { status: "installing" } });
    const reconstructed = mods({}); // r1 absent

    expect(planSessionResync(current, reconstructed)).toEqual([]);
  });
});
