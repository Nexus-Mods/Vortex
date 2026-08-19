/**
 * Skip attribution for collection members. A member can be skipped two ways - automatically
 * during install (InstallManager passes the dependency's mod reference) or by a free user
 * declining a queued download (nexus_integration passes the loose Nexus identifiers) - and both
 * resolve through markCollectionMemberSkipped: find the member in the active session and mark it
 * ignored (transient status + durable rule flag). Production flakiness lived in the free-user
 * identifier matching, so the matching paths are all exercised here.
 */
import { describe, expect } from "vitest";

import type { IModRule } from "../extensions/mod_management/types/IMod";
import {
  makeInstallState,
  makeMod,
  makeModInstallInfo,
  makeReference,
  makeRule,
  makeSession,
} from "../test-utils/builders";
import { test } from "../test-utils/harnessTest";
import type { IApiHarness, IDriverHarnessState } from "../test-utils/harnessTypes";
import { modRuleId } from "./collectionInstallSession";
import { getCollectionActiveSessionMod } from "./collectionInstallSessionSelectors";
import { markCollectionMemberSkipped } from "./collectionSkip";

const GAME_ID = "skyrimse";
const COLLECTION_ID = "col-1";
const SESSION_ID = "sess-1";

// the harness slices for an active session whose collection tracks the single given member rule.
// `liveRule` models the collection carrying a different snapshot of that member than the session
// was keyed with, which is what retagging a rule mid-install leaves behind.
function ruleOverrides(rule: IModRule, liveRule: IModRule = rule): Partial<IDriverHarnessState> {
  const collection = makeMod({ id: COLLECTION_ID, rules: [liveRule] });
  const session = makeSession({
    sessionId: SESSION_ID,
    collectionId: COLLECTION_ID,
    gameId: GAME_ID,
    mods: { [modRuleId(rule)]: makeModInstallInfo({ rule, status: "pending" }) },
  });
  return {
    mods: { [GAME_ID]: { [COLLECTION_ID]: collection } },
    session: makeInstallState({ activeSession: session }),
  };
}

const statusOf = (h: IApiHarness, rule: IModRule) =>
  getCollectionActiveSessionMod(h.getState(), modRuleId(rule))?.status;

// the durable `ignored` flag lives on the collection mod's rule (not the session), so it
// survives a restart; read it back through the real mods reducer the harness applies
const durableIgnored = (h: IApiHarness) =>
  h.getState().persistent.mods[GAME_ID][COLLECTION_ID].rules?.[0]?.ignored;

const repoRule = (overrides: Partial<IModRule["reference"]> = {}): IModRule =>
  makeRule({
    type: "requires",
    reference: makeReference({
      tag: "mod-repo",
      repo: { repository: "nexus", modId: "42", fileId: "100" },
      ...overrides,
    }),
  });

describe("markCollectionMemberSkipped - automatic skip (mod reference)", () => {
  test("ignores the member whose reference matches the skipped dependency", ({ makeApi }) => {
    const rule = makeRule({ type: "requires", reference: makeReference({ tag: "mod-a" }) });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      reference: makeReference({ tag: "mod-a" }),
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
    expect(durableIgnored(h)).toBe(true);
  });

  // the session is keyed by the member's rule as it was when the install started, so a skip
  // arriving with the retagged reference (same file, new tag) has to settle that same entry
  test("ignores the member whose live rule was retagged", ({ makeApi }) => {
    const rule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-a", fileMD5: "abc123" }),
    });
    const liveRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "adopted-tag", fileMD5: "abc123" }),
    });
    const h = makeApi(ruleOverrides(rule, liveRule));

    const matched = markCollectionMemberSkipped(h.api, {
      reference: makeReference({ tag: "adopted-tag", fileMD5: "abc123" }),
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
    expect(h.getState().session.collections.activeSession?.mods).not.toHaveProperty(
      modRuleId(liveRule),
    );
    // the durable flag still lands on the collection's current rule
    expect(durableIgnored(h)).toBe(true);
  });

  // a session can track a member the collection's current rules no longer carry (the rules were
  // replaced mid-install); the skip settles the session entry without re-adding the old rule
  test("settles a member whose rule left the collection without re-adding it", ({ makeApi }) => {
    const rule = makeRule({ type: "requires", reference: makeReference({ tag: "mod-a" }) });
    const unrelatedRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-other" }),
    });
    const h = makeApi(ruleOverrides(rule, unrelatedRule));

    const matched = markCollectionMemberSkipped(h.api, {
      reference: makeReference({ tag: "mod-a" }),
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
    // the collection's current rules are untouched
    const rules = h.getState().persistent.mods[GAME_ID][COLLECTION_ID].rules;
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.reference.tag).toBe("mod-other");
  });

  test("does nothing for a reference that is not a member", ({ makeApi }) => {
    const rule = makeRule({ type: "requires", reference: makeReference({ tag: "mod-a" }) });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      reference: makeReference({ tag: "not-a-member" }),
    });

    expect(matched).toBe(false);
    expect(statusOf(h, rule)).toBe("pending");
    expect(durableIgnored(h)).toBeUndefined();
  });
});

describe("markCollectionMemberSkipped - free-user skip (identifiers)", () => {
  test("ignores a member matched by logical file name", ({ makeApi }) => {
    const rule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-skip", logicalFileName: "Skip Me.7z" }),
    });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, fileNames: ["Skip Me.7z"] },
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
    expect(durableIgnored(h)).toBe(true);
  });

  test("does nothing when the file name matches no member", ({ makeApi }) => {
    const rule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-skip", logicalFileName: "Skip Me.7z" }),
    });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, fileNames: ["Other Mod.7z"] },
    });

    expect(matched).toBe(false);
    expect(statusOf(h, rule)).toBe("pending");
  });

  test("ignores a member on a definitive repo modId + fileId match", ({ makeApi }) => {
    const rule = repoRule();
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, modId: 42, fileIds: ["100"] },
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
  });

  test("does not ignore the same mod page but a different file", ({ makeApi }) => {
    const rule = repoRule();
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, modId: 42, fileIds: ["999"] },
    });

    expect(matched).toBe(false);
    expect(statusOf(h, rule)).toBe("pending");
  });

  test("does not ignore a different mod page", ({ makeApi }) => {
    const rule = repoRule();
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, modId: 99 },
    });

    expect(matched).toBe(false);
    expect(statusOf(h, rule)).toBe("pending");
  });

  test("ignores a fuzzy member by file name when the file id differs (update chain)", ({
    makeApi,
  }) => {
    // fixed bug: testRefByIdentifiers returns false on the file-id mismatch, but the fuzzy
    // fallback matches by the skipped file name instead
    const rule = repoRule({ versionMatch: "1.0.0+prefer", logicalFileName: "Fuzzy Mod.7z" });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: {
        gameId: GAME_ID,
        modId: 42,
        fileIds: ["999"],
        fileNames: ["Fuzzy Mod.7z"],
      },
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
  });

  test("ignores a fuzzy member matched by modId when the skip carries no file names", ({
    makeApi,
  }) => {
    // fixed bug: the previous inline handler dereferenced fileNames before guarding it and threw
    const rule = repoRule({ versionMatch: "1.0.0+prefer" });
    const h = makeApi(ruleOverrides(rule));

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, modId: 42 },
    });

    expect(matched).toBe(true);
    expect(statusOf(h, rule)).toBe("ignored");
  });
});

describe("markCollectionMemberSkipped - no active session", () => {
  test("is a no-op when no collection install is active", ({ makeApi }) => {
    const h = makeApi();

    const matched = markCollectionMemberSkipped(h.api, {
      identifiers: { gameId: GAME_ID, fileNames: ["Anything.7z"] },
    });

    expect(matched).toBe(false);
  });
});
