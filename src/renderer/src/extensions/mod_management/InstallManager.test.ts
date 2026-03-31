import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { IExtensionApi, IState } from "../../types/api";
import type { IModRule } from "./types/IMod";

import InstallManager from "./InstallManager";

// Mock dependencies
vi.mock("./util/dependencies");
vi.mock("../../util/api");
vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

/** Subset of InstallManager internals exercised by these tests. */
interface IInstallManagerTestable {
  ensurePhaseState(sourceModId: string): void;
  maybeAdvancePhase(sourceModId: string, api: IExtensionApi): void;
  markPhaseDownloadsFinished(
    sourceModId: string,
    phase: number,
    api: IExtensionApi,
  ): void;
  mInstallPhaseState: Map<
    string,
    {
      allowedPhase: number | undefined;
      downloadsFinished: Set<number>;
      pendingByPhase: Map<number, Array<() => void>>;
      activeByPhase: Map<number, number>;
      deploymentPromises: Map<number, Promise<void>>;
      deployedPhases: Set<number>;
      reQueueAttempted?: Map<number, number>;
    }
  >;
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

    installManager = new InstallManager(
      mockApi,
      vi.fn(),
    ) as unknown as IInstallManagerTestable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Phase State Management", () => {
    it("should initialize phase state correctly", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state1 = installManager.mInstallPhaseState.get(sourceModId);
      state1.allowedPhase = 2;

      installManager.ensurePhaseState(sourceModId);
      const state2 = installManager.mInstallPhaseState.get(sourceModId);

      expect(state2.allowedPhase).toBe(2);
      expect(state1).toBe(state2);
    });
  });

  describe("Phase Advancement", () => {
    it("should advance phase when current phase is complete", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

    function detectHighestCompletedPhase(
      mods: Record<string, CollectionMod>,
    ): number {
      const allMods = Object.values(mods);
      const allPhases = new Set(allMods.map((m) => m.phase ?? 0));
      let highest = -1;

      for (const phase of Array.from(allPhases).sort((a, b) => a - b)) {
        const required = allMods.filter(
          (m) => (m.phase ?? 0) === phase && m.type === "requires",
        );
        const completed = required.filter((m) =>
          ["installed", "failed", "skipped"].includes(m.status),
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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }

      expect(state.reQueueAttempted.has(1)).toBe(false);
      state.reQueueAttempted.set(1, Date.now());
      expect(state.reQueueAttempted.has(1)).toBe(true);
    });

    it("should not re-queue same phase twice", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);
      expect(state.downloadsFinished.has(1)).toBe(true);
    });

    it("should initialize allowed phase on first download finish", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      expect(state.allowedPhase).toBeUndefined();
      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);
      expect(state.allowedPhase).toBe(2);
    });

    it("should not change allowed phase if already set", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);
      state.allowedPhase = 1;

      installManager.markPhaseDownloadsFinished(sourceModId, 3, mockApi);

      expect(state.allowedPhase).toBe(1);
      expect(state.downloadsFinished.has(3)).toBe(true);
    });
  });

  describe("Collection Session Phase Assignment", () => {
    it("should assign phase 0 when rule.extra.phase is undefined", () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: "test-mod" },
        type: "requires",
      };

      const phase: number = (rule.extra?.phase as number | undefined) ?? 0;
      expect(phase).toBe(0);
    });

    it("should use phase from rule.extra.phase when present", () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: "test-mod" },
        type: "requires",
        extra: { phase: 3 },
      };

      const phase: number = (rule.extra?.phase as number | undefined) ?? 0;
      expect(phase).toBe(3);
    });

    it("should handle null extra field", () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: "test-mod" },
        type: "requires",
        extra: null,
      };

      const phase: number = (rule.extra?.phase as number | undefined) ?? 0;
      expect(phase).toBe(0);
    });
  });

  describe("Phase Gating", () => {
    it("should allow installation in current phase", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);
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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      state.activeByPhase.set(1, 3);
      state.activeByPhase.set(2, 0);

      expect(state.activeByPhase.get(1)).toBe(3);
      expect(state.activeByPhase.get(2)).toBe(0);
      expect(state.activeByPhase.get(3) ?? 0).toBe(0);
    });

    it("should track pending installations per phase", () => {
      const sourceModId = "test-collection-1";

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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
