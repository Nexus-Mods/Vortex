import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { updateModStatus } from "../../actions/collectionInstallTracking";
import {
  makeDownload,
  makeMod,
  makeModInstallInfo,
  makeRule,
  makeSession,
} from "../../test-utils/builders";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { resyncCollectionSessionRules } from "../../util/collectionSessionReconstruct";
import InstallManager from "./InstallManager";
import { lookupFromDownload } from "./util/dependencies";
import type { InstallPhaseTracker } from "./util/InstallPhaseTracker";

// Mock dependencies
vi.mock("./util/dependencies");
vi.mock("../../util/collectionSessionReconstruct");
vi.mock("../../util/api");
vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

// TODO: prefer the shared api/harness fixtures (makeApiHarness and the test.extend fixtures in
// test-utils) over the hand-built mockApi/mockState in this file; new tests should seed state with
// the builders instead of adding more bespoke mocks.

/** Subset of InstallManager internals exercised by these tests. */
interface IInstallManagerTestable {
  maybeAdvancePhase(sourceModId: string, api: IExtensionApi): void;
  handleDownloadFailed(api: IExtensionApi, downloadId: string): void;
  cleanupPendingInstalls(sourceModId: string, hard?: boolean): void;
  doInstallDependenciesPhase(
    api: IExtensionApi,
    dependencies: unknown[],
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    doDownload: (dep: unknown) => Promise<{ updatedDep: unknown; downloadId: string }>,
    abort: AbortController,
    silent: boolean,
  ): Promise<unknown[]>;
  markPhaseDownloadsFinished(sourceModId: string, phase: number, api: IExtensionApi): void;
  // per-collection phase-gating state now lives on the tracker; tests drive it directly
  mPhaseTracker: InstallPhaseTracker;
}

describe("Phased Installer", () => {
  let installManager: IInstallManagerTestable;
  let mockApi: IExtensionApi;
  let mockState: Record<string, unknown>;

  beforeEach(() => {
    mockState = {
      persistent: {
        mods: {},
        downloads: { files: {} },
        profiles: {},
      },
      session: {
        collections: { activeSession: null },
      },
      settings: {
        downloads: { collectionsInstallWhileDownloading: false },
        profiles: {
          activeProfileId: "test-profile-1",
          nextProfileId: undefined,
          lastActiveProfile: {},
        },
      },
    };

    mockApi = {
      getState: vi.fn(() => mockState as unknown as IState),
      store: {
        dispatch: vi.fn(),
        getState: vi.fn(() => mockState as unknown as IState),
      },
      events: {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
      },
      onAsync: vi.fn(),
      onStateChange: vi.fn(),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
      translate: vi.fn((key: string) => key),
      registerInstaller: vi.fn(),
    } as unknown as IExtensionApi;

    installManager = new InstallManager(mockApi, vi.fn()) as unknown as IInstallManagerTestable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Phase State Management", () => {
    it("should initialize phase state correctly", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      expect(state).toBeDefined();
      expect(state.allowedPhase).toBeUndefined();
      expect(state.downloadsFinished).toBeInstanceOf(Set);
      expect(state.pendingByPhase).toBeInstanceOf(Map);
      expect(state.activeByPhase).toBeInstanceOf(Map);
      expect(state.deploymentPromises).toBeInstanceOf(Map);
      expect(state.deployedPhases).toBeInstanceOf(Set);
    });

    it("should not reinitialize existing phase state", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state1 = installManager.mPhaseTracker.get(sourceModId);
      state1.allowedPhase = 2;

      installManager.mPhaseTracker.ensure(sourceModId);
      const state2 = installManager.mPhaseTracker.get(sourceModId);

      expect(state2.allowedPhase).toBe(2);
      expect(state1).toBe(state2);
    });
  });

  describe("Phase Advancement", () => {
    it("should advance phase when current phase is complete", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.deployedPhases.add(0);
      state.activeByPhase.set(0, 0);
      state.activeByPhase.set(1, 0);

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(1);
    });

    it("should not advance phase if previous phase not deployed", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.activeByPhase.set(0, 0);
      state.activeByPhase.set(1, 0);

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(0);
    });

    it("should not advance if active installations in current phase", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.activeByPhase.set(0, 2);
      state.deployedPhases.add(0);

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(0);
    });
  });

  describe("Collection Phase Detection", () => {
    interface CollectionMod {
      phase: number;
      type: string;
      status: string;
    }

    function detectHighestCompletedPhase(mods: Record<string, CollectionMod>): number {
      const allMods = Object.values(mods);
      const allPhases = new Set(allMods.map((m) => m.phase ?? 0));
      let highest = -1;

      for (const phase of Array.from(allPhases).sort((a, b) => a - b)) {
        const required = allMods.filter((m) => (m.phase ?? 0) === phase && m.type === "requires");
        const completed = required.filter((m) =>
          ["installed", "failed", "ignored"].includes(m.status),
        );
        if (completed.length >= required.length && required.length > 0) {
          highest = phase;
        }
      }
      return highest;
    }

    it("should detect completed phases from collection session", () => {
      const mods: Record<string, CollectionMod> = {
        "mod-0-1": { phase: 0, type: "requires", status: "installed" },
        "mod-1-1": { phase: 1, type: "requires", status: "installed" },
        "mod-1-2": { phase: 1, type: "requires", status: "installed" },
        "mod-1-3": { phase: 1, type: "recommends", status: "installed" },
        "mod-2-1": { phase: 2, type: "requires", status: "pending" },
        "mod-2-2": { phase: 2, type: "requires", status: "pending" },
      };

      expect(detectHighestCompletedPhase(mods)).toBe(1);
    });

    it("should handle collection with no completed phases", () => {
      const mods: Record<string, CollectionMod> = {
        "mod-0-1": { phase: 0, type: "requires", status: "pending" },
        "mod-1-1": { phase: 1, type: "requires", status: "pending" },
      };

      expect(detectHighestCompletedPhase(mods)).toBe(-1);
    });
  });

  describe("Re-queue Prevention", () => {
    it("should track re-queue attempts per phase", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }

      expect(state.reQueueAttempted.has(1)).toBe(false);
      state.reQueueAttempted.set(1, Date.now());
      expect(state.reQueueAttempted.has(1)).toBe(true);
    });

    it("should not re-queue same phase twice", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }

      const phase = 2;
      expect(state.reQueueAttempted.has(phase)).toBe(false);
      state.reQueueAttempted.set(phase, Date.now());
      expect(state.reQueueAttempted.has(phase)).toBe(true);
    });
  });

  describe("Phase Downloads Tracking", () => {
    it("should mark phase downloads as finished", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mPhaseTracker.get(sourceModId);
      expect(state.downloadsFinished.has(1)).toBe(true);
    });

    it("should initialize allowed phase on first download finish", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      expect(state.allowedPhase).toBeUndefined();
      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);
      expect(state.allowedPhase).toBe(2);
    });

    it("should not change allowed phase if already set", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);
      state.allowedPhase = 1;

      installManager.markPhaseDownloadsFinished(sourceModId, 3, mockApi);

      expect(state.allowedPhase).toBe(1);
      expect(state.downloadsFinished.has(3)).toBe(true);
    });
  });

  describe("Phase Gating", () => {
    it("should allow installation in current phase", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      // the collection's real phases; the earlier-phase backfill marks the real phases below the
      // finished one (0 and 1), never phantom integers 0..phase.
      installManager.mPhaseTracker.get(sourceModId).phaseSet = [0, 1, 2, 3];
      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      const state = installManager.mPhaseTracker.get(sourceModId);

      const canStart = (phase: number) =>
        state.allowedPhase !== undefined &&
        phase <= state.allowedPhase &&
        state.downloadsFinished.has(phase);

      expect(canStart(2)).toBe(true);
      expect(canStart(1)).toBe(true);
      expect(canStart(0)).toBe(true);
      expect(canStart(3)).toBe(false);
    });

    it("should block installation in future phases", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);
      state.allowedPhase = 1;
      state.downloadsFinished.add(1);

      const canStart = (phase: number) =>
        state.allowedPhase !== undefined &&
        phase <= state.allowedPhase &&
        state.downloadsFinished.has(phase);

      expect(canStart(2)).toBe(false);
      expect(canStart(3)).toBe(false);
    });
  });

  describe("Concurrent Phase Processing", () => {
    it("should track active installations per phase", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      state.activeByPhase.set(1, 3);
      state.activeByPhase.set(2, 0);

      expect(state.activeByPhase.get(1)).toBe(3);
      expect(state.activeByPhase.get(2)).toBe(0);
      expect(state.activeByPhase.get(3) ?? 0).toBe(0);
    });

    it("should track pending installations per phase", () => {
      const sourceModId = "test-collection-1";

      installManager.mPhaseTracker.ensure(sourceModId);
      const state = installManager.mPhaseTracker.get(sourceModId);

      const tasks1 = [vi.fn(), vi.fn()];
      const tasks2 = [vi.fn()];

      state.pendingByPhase.set(1, tasks1);
      state.pendingByPhase.set(2, tasks2);

      expect(state.pendingByPhase.get(1)?.length).toBe(2);
      expect(state.pendingByPhase.get(2)?.length).toBe(1);
      expect(state.pendingByPhase.get(3) ?? []).toEqual([]);
    });
  });
});

describe("collection download failure handling", () => {
  let installManager: IInstallManagerTestable;
  let dispatch: ReturnType<typeof vi.fn>;
  let state: Record<string, unknown>;
  let api: IExtensionApi;

  beforeEach(() => {
    dispatch = vi.fn();
    state = {
      persistent: {
        profiles: { prof1: { id: "prof1", gameId: "skyrimse" } },
        mods: { skyrimse: { "col-1": makeMod({ id: "col-1", rules: [] }) } },
        downloads: {
          files: {
            "dl-fail": makeDownload({
              id: "dl-fail",
              state: "failed",
              localPath: "member.zip",
              modInfo: { referenceTag: "member-tag" },
            }),
          },
        },
      },
      session: {
        collections: {
          activeSession: makeSession({
            sessionId: "col-1_prof1",
            collectionId: "col-1",
            gameId: "skyrimse",
            mods: {
              "rule-1": makeModInstallInfo({
                rule: makeRule({ reference: { tag: "member-tag" } }),
                status: "downloading",
              }),
            },
          }),
        },
      },
      settings: {
        downloads: { collectionsInstallWhileDownloading: false },
        profiles: { activeProfileId: "prof1", nextProfileId: undefined, lastActiveProfile: {} },
      },
    };

    api = {
      getState: () => state as unknown as IState,
      store: { getState: () => state as unknown as IState, dispatch },
      events: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
      onAsync: vi.fn(),
      onStateChange: vi.fn(),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
      translate: vi.fn((key: string) => key),
      registerInstaller: vi.fn(),
    } as unknown as IExtensionApi;

    // findCollectionByDownload resolves the member from the download's lookup (referenceTag match)
    vi.mocked(lookupFromDownload).mockReturnValue({
      referenceTag: "member-tag",
      fileName: "member.zip",
    } as never);

    installManager = new InstallManager(api, vi.fn()) as unknown as IInstallManagerTestable;
    // mark the collection as actively installing so the failure is not ignored
    installManager.mPhaseTracker.ensure("col-1");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("settles the member as failed when its download terminally fails", () => {
    installManager.handleDownloadFailed(api, "dl-fail");

    // status leaves "downloading" so the row is no longer mis-bucketed under the Downloading filter
    expect(dispatch).toHaveBeenCalledWith(updateModStatus("col-1_prof1", "rule-1", "failed"));
  });

  it("settles the member as failed when its download terminally fails in the install phase", async () => {
    // The download is settled from the install phase using the dependency's own reference, so a
    // failed download that can't be matched back by tag/md5 (e.g. resumed from another install,
    // and md5-less because it never completed) still moves the member off "downloading".
    const doDownload = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Failed to open temp"), { code: "fs-error" }));

    await installManager.doInstallDependenciesPhase(
      api,
      [{ reference: { tag: "member-tag" }, phase: 0, extra: {} }],
      "skyrimse",
      "col-1",
      false,
      doDownload,
      new AbortController(),
      true,
    );

    expect(dispatch).toHaveBeenCalledWith(updateModStatus("col-1_prof1", "rule-1", "failed"));
  });
});

describe("cleanupPendingInstalls session resync", () => {
  let installManager: IInstallManagerTestable;
  let state: Record<string, unknown>;
  let api: IExtensionApi;

  const memberRule = makeRule({ type: "requires", reference: { tag: "m1" } });

  beforeEach(() => {
    vi.mocked(resyncCollectionSessionRules).mockClear();
    state = {
      persistent: {
        mods: { skyrimse: { "col-1": makeMod({ id: "col-1", rules: [memberRule] }) } },
        downloads: { files: {} },
      },
      session: {
        collections: {
          activeSession: makeSession({
            sessionId: "col-1_prof1",
            collectionId: "col-1",
            gameId: "skyrimse",
            mods: {
              requires_m1: makeModInstallInfo({ rule: memberRule, status: "installing" }),
            },
          }),
        },
      },
    };
    api = {
      getState: () => state as unknown as IState,
      store: { getState: () => state as unknown as IState, dispatch: vi.fn() },
      events: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
      onAsync: vi.fn(),
      onStateChange: vi.fn(),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
      translate: vi.fn((key: string) => key),
      registerInstaller: vi.fn(),
    } as unknown as IExtensionApi;
    installManager = new InstallManager(api, vi.fn()) as unknown as IInstallManagerTestable;
  });

  afterEach(() => vi.clearAllMocks());

  it("re-derives the collection session from reality when tearing down its active install", () => {
    // a member left mid-"installing" on pause/cancel/stall must not keep the stale status
    installManager.cleanupPendingInstalls("col-1", true);
    expect(resyncCollectionSessionRules).toHaveBeenCalledWith(api, [memberRule]);
  });

  it("does not resync when the torn-down mod is not the active collection", () => {
    installManager.cleanupPendingInstalls("some-other-mod", true);
    expect(resyncCollectionSessionRules).not.toHaveBeenCalled();
  });
});
