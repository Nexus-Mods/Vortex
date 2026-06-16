/**
 * Tests for buildCollectionItemRows - the pure row-assembly that replaces the old
 * in-component `modsEx` cache. Covers the three derivation paths (installed mod /
 * present download / not-yet-fetched stub) so the behaviour matches the former
 * modFromRule/modFromDownload, plus the install-session status overlay that makes
 * the session the source of truth for live install state.
 */

import { describe, it, expect, vi } from "vitest";

import type { ICollectionModInstallInfo } from "../../../types/collections/ICollectionInstallSession";
import { modRuleId } from "../../../util/collectionInstallSession";
import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModAttributes, IModRule } from "../../mod_management/types/IMod";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import { buildCollectionItemRows } from "./itemRows";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));

const requiresRule = (over: Partial<IModRule> = {}): IModRule => ({
  type: "requires",
  reference: { id: "mod-1", description: "Mod One" },
  ...over,
});

const installedMod = (id: string, attributes: IModAttributes = {}): IMod => ({
  id,
  state: "installed",
  type: "",
  installationPath: `mods/${id}`,
  attributes: { name: id, ...attributes },
});

const makeDownload = (over: Partial<IDownload> = {}): IDownload => ({
  id: "dl",
  state: "started",
  urls: [],
  game: ["skyrimse"],
  modInfo: {},
  startTime: 0,
  fileTime: 0,
  size: 0,
  received: 0,
  verified: 0,
  ...over,
});

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
    expect(row.progress).toBeCloseTo(0.25);
    expect(row.attributes?.fileName).toBe("file.7z");
    expect(row.attributes?.version).toBe("2.0");
    // an unfinished download infers to "downloading"
    expect(row.status).toBe("downloading");
  });

  it("marks a finished download as downloaded with no progress", () => {
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

    expect(row.progress).toBeUndefined();
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
});
