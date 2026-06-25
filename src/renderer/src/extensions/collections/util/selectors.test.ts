import { describe, expect, it } from "vitest";

import { makeSession as makeSessionBase } from "../../../test-utils/builders";
import type {
  ICollectionInstallSession,
  ICollectionModInstallInfo,
} from "../../../types/collections/ICollectionInstallSession";
import type { IState } from "../../../types/IState";
import type { IModRule } from "../../mod_management/types/IMod";
import {
  getActiveInstallSession,
  getCollectionInstallProgress,
  getCollectionModsStatus,
  getInstallationSummary,
  getOptionalModsProgress,
  getRequiredModsProgress,
  isInstallationActive,
} from "./selectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(activeSession?: ICollectionInstallSession): IState {
  return {
    session: {
      collections: {
        activeSession,
        lastActiveSessionId: activeSession?.sessionId,
        sessionHistory: {},
      },
    },
  } as unknown as IState;
}

// these selector tests assume a 3-required / 2-optional session by default
function makeSession(
  overrides: Partial<ICollectionInstallSession> = {},
): ICollectionInstallSession {
  return makeSessionBase({ totalRequired: 3, totalOptional: 2, ...overrides });
}

// the selectors only read a few fields off each mod entry (type/status/modId and rule.reference),
// so these tests model partial entries; the single cast localizes the partial shape here.
type PartialModInstallInfo = Partial<Omit<ICollectionModInstallInfo, "rule">> & {
  rule?: Partial<IModRule>;
};

function makeMods(
  entries: Record<string, PartialModInstallInfo>,
): Record<string, ICollectionModInstallInfo> {
  return entries as Record<string, ICollectionModInstallInfo>;
}

// ---------------------------------------------------------------------------
// getActiveInstallSession
// ---------------------------------------------------------------------------

describe("getActiveInstallSession", () => {
  it("returns undefined when there is no active session", () => {
    const state = makeState();
    expect(getActiveInstallSession(state)).toBeUndefined();
  });

  it("returns the active session when present", () => {
    const session = makeSession();
    const state = makeState(session);
    expect(getActiveInstallSession(state)).toBe(session);
  });

  it("returns fallback when session state is missing entirely", () => {
    const emptyState = {} as IState;
    expect(getActiveInstallSession(emptyState)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isInstallationActive
// ---------------------------------------------------------------------------

describe("isInstallationActive", () => {
  it("returns false when no session", () => {
    expect(isInstallationActive(makeState())).toBe(false);
  });

  it("returns true when a session exists", () => {
    expect(isInstallationActive(makeState(makeSession()))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCollectionInstallProgress
// ---------------------------------------------------------------------------

describe("getCollectionInstallProgress", () => {
  it("returns null when no session", () => {
    expect(getCollectionInstallProgress(makeState(), "col1")).toBeNull();
  });

  it("returns null when collectionId does not match", () => {
    const session = makeSession({ collectionId: "other" });
    expect(getCollectionInstallProgress(makeState(session), "col1")).toBeNull();
  });

  it("returns progress for the matching collection", () => {
    const session = makeSession({
      installedCount: 2,
      totalRequired: 3,
      totalOptional: 2,
    });
    const result = getCollectionInstallProgress(makeState(session), "col1");

    expect(result).toEqual({ installed: 2, total: 5 });
  });
});

// ---------------------------------------------------------------------------
// getRequiredModsProgress
// ---------------------------------------------------------------------------

describe("getRequiredModsProgress", () => {
  it("returns null when no session", () => {
    expect(getRequiredModsProgress(makeState(), "col1")).toBeNull();
  });

  it("returns null for non-matching collectionId", () => {
    const session = makeSession({ collectionId: "other" });
    expect(getRequiredModsProgress(makeState(session), "col1")).toBeNull();
  });

  it("counts required mods correctly", () => {
    const session = makeSession({
      totalRequired: 3,
      mods: makeMods({
        r1: { type: "requires", status: "installed", rule: {} },
        r2: { type: "requires", status: "downloading", rule: {} },
        r3: { type: "requires", status: "failed", rule: {} },
        o1: { type: "recommends", status: "installed", rule: {} },
      }),
    });
    const result = getRequiredModsProgress(makeState(session), "col1");

    expect(result).toEqual({
      installed: 1,
      total: 3,
      failed: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// getOptionalModsProgress
// ---------------------------------------------------------------------------

describe("getOptionalModsProgress", () => {
  it("returns null when no session", () => {
    expect(getOptionalModsProgress(makeState(), "col1")).toBeNull();
  });

  it("counts optional mods correctly", () => {
    const session = makeSession({
      totalOptional: 2,
      mods: makeMods({
        r1: { type: "requires", status: "installed", rule: {} },
        o1: { type: "recommends", status: "installed", rule: {} },
        o2: { type: "recommends", status: "ignored", rule: {} },
      }),
    });
    const result = getOptionalModsProgress(makeState(session), "col1");

    expect(result).toEqual({
      installed: 1,
      total: 2,
      ignored: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// getCollectionModsStatus
// ---------------------------------------------------------------------------

describe("getCollectionModsStatus", () => {
  it("returns empty array when no session", () => {
    expect(getCollectionModsStatus(makeState(), "col1")).toEqual([]);
  });

  it("returns empty array for non-matching collection", () => {
    const session = makeSession({ collectionId: "other" });
    expect(getCollectionModsStatus(makeState(session), "col1")).toEqual([]);
  });

  it("maps mod entries to status objects", () => {
    const session = makeSession({
      mods: makeMods({
        r1: {
          type: "requires",
          status: "installed",
          modId: "mod-abc",
          rule: {
            reference: { description: "Cool Mod" },
          },
        },
      }),
    });
    const result = getCollectionModsStatus(makeState(session), "col1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ruleId: "r1",
      modName: "Cool Mod",
      status: "installed",
      type: "requires",
      modId: "mod-abc",
    });
  });

  it("falls back to logicalFileName for modName", () => {
    const session = makeSession({
      mods: makeMods({
        r1: {
          type: "requires",
          status: "pending",
          rule: {
            reference: { logicalFileName: "FallbackName" },
          },
        },
      }),
    });
    const result = getCollectionModsStatus(makeState(session), "col1");

    expect(result[0].modName).toBe("FallbackName");
  });

  it("falls back to 'Unknown Mod' when no name available", () => {
    const session = makeSession({
      mods: makeMods({
        r1: {
          type: "requires",
          status: "pending",
          rule: { reference: {} },
        },
      }),
    });
    const result = getCollectionModsStatus(makeState(session), "col1");

    expect(result[0].modName).toBe("Unknown Mod");
  });
});

// ---------------------------------------------------------------------------
// getInstallationSummary
// ---------------------------------------------------------------------------

describe("getInstallationSummary", () => {
  it("returns inactive summary when no session", () => {
    const result = getInstallationSummary(makeState());
    expect(result).toEqual({ isActive: false });
  });

  it("returns full summary when session exists", () => {
    const session = makeSession({
      installedCount: 2,
      totalRequired: 3,
      totalOptional: 1,
      mods: makeMods({
        r1: { type: "requires", status: "installed" },
        r2: { type: "requires", status: "installed" },
        r3: { type: "requires", status: "downloading" },
        o1: { type: "recommends", status: "pending" },
      }),
    });
    const result = getInstallationSummary(makeState(session));

    expect(result.isActive).toBe(true);
    expect(result.collectionId).toBe("col1");
    expect(result.gameId).toBe("skyrimse");
    expect(result.installedMods).toBe(2);
    expect(result.totalMods).toBe(4);
    expect(result.requiredMods).toEqual({ installed: 2, total: 3 });
  });
});
