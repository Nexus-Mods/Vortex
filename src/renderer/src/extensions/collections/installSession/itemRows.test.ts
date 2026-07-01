/**
 * Tests for buildCollectionItemRows - the pure row-assembly that replaces the old
 * in-component `modsEx` cache. Covers the three derivation paths (installed mod /
 * present download / not-yet-fetched stub) so the behaviour matches the former
 * modFromRule/modFromDownload, plus the install-session status overlay that makes
 * the session the source of truth for live install state.
 */

import { describe, it, expect, vi } from "vitest";

import { makeDownload, makeMod, makeRule } from "../../../test-utils/builders";
import type { ICollectionModInstallInfo } from "../../../types/collections/ICollectionInstallSession";
import { modRuleId } from "../../../util/collectionInstallSession";
import { reconstructSessionMods } from "../../../util/collectionSessionReconstruct";
import type { IMod, IModAttributes, IModRule } from "../../mod_management/types/IMod";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import { buildCollectionItemRows } from "./itemRows";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));

// domain-specific conveniences over the shared builders: a requires-rule referencing
// "mod-1" by id, and an installed mod whose attributes.name defaults to its id
const requiresRule = (over: Partial<IModRule> = {}): IModRule =>
  makeRule({ reference: { id: "mod-1", description: "Mod One" }, ...over });

const installedMod = (id: string, attributes: IModAttributes = {}): IMod =>
  makeMod({ id, installationPath: `mods/${id}`, attributes: { name: id, ...attributes } });

describe("buildCollectionItemRows", () => {
  it("filters out rules that are not requires/recommends", () => {
    const rows = buildCollectionItemRows({
      rules: [
        requiresRule(),
        { type: "before", reference: { id: "x" } },
        { type: "conflicts", reference: { id: "y" } },
      ],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: {},
    });

    expect(Object.keys(rows)).toHaveLength(1);
    expect(Object.keys(rows)[0]).toBe(modRuleId(requiresRule()));
  });

  it("derives an installed mod from persistent mods + profile modState", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    // keyed by mod id
    const mods: Record<string, IMod> = { "mod-1": installedMod("mod-1", { version: "1.2.3" }) };
    // keyed by mod id
    const modState: Record<string, IProfileMod> = { "mod-1": { enabled: true, enabledTime: 42 } };

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods,
      downloads: {},
      modState,
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.id).toBe("mod-1");
    expect(row.enabled).toBe(true);
    expect(row.attributes?.version).toBe("1.2.3");
    expect(row.collectionRule).toBe(rule);
    // no active session: status is reconstructed from persistent state
    expect(row.status).toBe("installed");
  });

  it("derives a present download when the mod is not installed", () => {
    const rule = requiresRule({ reference: { md5Hint: "abc", gameId: "skyrimse" } });
    const download = makeDownload({
      state: "started",
      received: 50,
      size: 200,
      fileMD5: "abc",
      modInfo: { nexus: { fileInfo: { name: "file.7z", mod_version: "2.0" } } },
    });

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: { dl1: download },
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.archiveId).toBe("dl1");
    expect(row.attributes?.fileName).toBe("file.7z");
    expect(row.attributes?.version).toBe("2.0");
    // an unfinished download infers to "downloading"
    expect(row.status).toBe("downloading");
  });

  it("marks a finished download as downloaded", () => {
    const rule = requiresRule({ reference: { md5Hint: "abc" } });
    const download = makeDownload({
      state: "finished",
      received: 200,
      size: 200,
      fileMD5: "abc",
    });

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: { dl1: download },
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.status).toBe("downloaded");
  });

  it("resolves a tagged rule's installed mod via the referenceTag index", () => {
    // installed collection mods carry the rule's referenceTag; resolution uses the prebuilt tag
    // index rather than scanning every mod
    const rule = requiresRule({ reference: { tag: "mod-ref-tag" } });
    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {
        m1: installedMod("m1", { referenceTag: "mod-ref-tag" }),
        m2: installedMod("m2", { referenceTag: "other-tag" }),
      },
      downloads: {},
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.id).toBe("m1");
    expect(row.status).toBe("installed");
  });

  it("falls back to fileMD5 when a tagged rule's installed mod carries a different tag", () => {
    // a member whose referenceTag drifted, or that was matched by hash rather than tag, is still
    // recognised by content hash - so it is not wrongly shown as not-installed
    const rule = requiresRule({ reference: { tag: "rule-tag", fileMD5: "hash-xyz" } });
    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: { m1: installedMod("m1", { referenceTag: "drifted-tag", fileMD5: "hash-xyz" }) },
      downloads: {},
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.id).toBe("m1");
    expect(row.status).toBe("installed");
  });

  it("resolves a fuzzy member installed under another collection's tag, matching the session", () => {
    // Two collections include the same member. Collection 1 installed it, so the mod on disk carries
    // collection 1's referenceTag. Collection 2's rule carries a different tag and, being a
    // fuzzy/latest member, has no fileMD5 - so the tag index misses and there is no hash fallback.
    // The session resolves the member by identity (reconstructSessionMods -> findModByRef) and sees
    // it installed, which is what drives completion; the table must agree, not show it "pending".
    const rule = requiresRule({ reference: { tag: "tag-col2", logicalFileName: "MCM" } });
    const mods = {
      "inst-mcm": installedMod("inst-mcm", { referenceTag: "tag-col1", logicalFileName: "MCM" }),
    };

    // the session (identity-aware) sees the member installed - so completion treats it as resolved
    const sessionMods = reconstructSessionMods({ rules: [rule], mods, downloads: {} });
    expect(sessionMods[modRuleId(rule)].status).toBe("installed");

    // the table must resolve the same installed mod rather than falling back to "pending"
    const rows = buildCollectionItemRows({
      rules: [rule],
      mods,
      downloads: {},
      modState: {},
      sessionMods: {},
    });
    expect(rows[modRuleId(rule)].status).toBe("installed");
  });

  it("resolves a tagged rule's download via the referenceTag index", () => {
    // collection downloads are stamped with the rule's referenceTag; the row resolution uses the
    // prebuilt tag index rather than scanning every download
    const rule = requiresRule({ reference: { tag: "ref-tag-1" } });
    const download = makeDownload({
      state: "finished",
      received: 100,
      size: 100,
      modInfo: { referenceTag: "ref-tag-1" },
    });

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: { dlA: download, dlB: makeDownload({ state: "finished" }) },
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.archiveId).toBe("dlA");
    expect(row.status).toBe("downloaded");
  });

  it("produces a stub from the rule when neither installed nor downloaded", () => {
    const rule = requiresRule({
      reference: { logicalFileName: "Some Mod.7z", fileSize: 1024 },
      extra: { name: "Some Mod" },
    });

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.enabled).toBe(false);
    expect(row.attributes?.fileSize).toBe(1024);
    expect(row.attributes?.fileName).toBe("Some Mod");
    // no mod/download id yet, so the stub uses the stable rule id
    expect(row.id).toBe(modRuleId(rule));
    // nothing known yet: reconstructed status downgrades to pending
    expect(row.status).toBe("pending");
  });

  it("uses the active-session status as the source of truth for live state", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    // persistent says nothing is installed yet (stub), but the session says it is installing
    // keyed by rule id
    const session: Record<string, ICollectionModInstallInfo> = {
      [modRuleId(rule)]: { rule, status: "installing", type: "requires" },
    };

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: session,
    });
    const row = rows[modRuleId(rule)];

    expect(row.status).toBe("installing");
  });

  it("carries a terminal session status (failed)", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    // keyed by rule id
    const session: Record<string, ICollectionModInstallInfo> = {
      [modRuleId(rule)]: { rule, status: "failed", type: "requires" },
    };

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: session,
    });
    const row = rows[modRuleId(rule)];

    expect(row.status).toBe("failed");
  });

  it('lets a terminal download failure override a stale session "downloading"', () => {
    // The live session keeps a failed member on "downloading"; the row must report "failed" so the
    // status column's filter/sort agree with the "Download failed" label. Reality wins.
    const rule = requiresRule({ reference: { tag: "ref-fail" } });
    const download = makeDownload({ state: "failed", modInfo: { referenceTag: "ref-fail" } });
    // keyed by rule id: the session snapshot is still the pre-failure "downloading"
    const session: Record<string, ICollectionModInstallInfo> = {
      [modRuleId(rule)]: { rule, status: "downloading", type: "requires" },
    };

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: { dlFail: download },
      modState: {},
      sessionMods: session,
    });

    expect(rows[modRuleId(rule)].status).toBe("failed");
  });

  it("reconstructs status from persistent state for rules outside the session", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    // a session entry for a different rule must not bleed into this row
    // keyed by rule id
    const session: Record<string, ICollectionModInstallInfo> = {
      requires_other: {
        rule: requiresRule({ reference: { id: "other" } }),
        status: "installing",
        type: "requires",
      },
    };

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: session,
    });
    const row = rows[modRuleId(rule)];

    // not in the session and nothing installed/downloaded -> pending, never undefined
    expect(row.status).toBe("pending");
  });

  it("reconstructs an ignored rule's status even with no session", () => {
    const rule = requiresRule({ reference: { id: "mod-1" }, ignored: true });

    const rows = buildCollectionItemRows({
      rules: [rule],
      mods: {},
      downloads: {},
      modState: {},
      sessionMods: {},
    });
    const row = rows[modRuleId(rule)];

    expect(row.status).toBe("ignored");
  });

  it("reuses the prior map and row references when nothing changed", () => {
    const rule = requiresRule({ reference: { id: "mod-1" } });
    const params = {
      rules: [rule],
      mods: { "mod-1": installedMod("mod-1", { version: "1.0.0" }) },
      downloads: {},
      modState: {},
      sessionMods: {},
    };

    const first = buildCollectionItemRows(params);
    // identical inputs -> the whole map (and every row) is handed back by reference
    const second = buildCollectionItemRows(params, first);

    expect(second).toBe(first);
  });

  it("replaces only the changed row's reference, keeping unchanged rows stable", () => {
    const ruleA = requiresRule({ reference: { id: "mod-1" } });
    const ruleB = makeRule({ reference: { id: "mod-2", description: "Mod Two" } });
    const mods: Record<string, IMod> = {
      "mod-1": installedMod("mod-1", { version: "1.0.0" }),
      "mod-2": installedMod("mod-2", { version: "2.0.0" }),
    };
    const params = { rules: [ruleA, ruleB], mods, downloads: {}, modState: {}, sessionMods: {} };
    const idA = modRuleId(ruleA);
    const idB = modRuleId(ruleB);

    const first = buildCollectionItemRows(params);

    // only mod-2 gets a new object, as the immutable reducer would produce on an attribute write
    const changedMods: Record<string, IMod> = {
      ...mods,
      "mod-2": installedMod("mod-2", { version: "2.1.0" }),
    };
    const second = buildCollectionItemRows({ ...params, mods: changedMods }, first);

    // mod-1 untouched -> same reference (table skips it); mod-2 changed -> fresh reference
    expect(second[idA]).toBe(first[idA]);
    expect(second[idB]).not.toBe(first[idB]);
    expect(second[idB].attributes?.version).toBe("2.1.0");
  });
});
