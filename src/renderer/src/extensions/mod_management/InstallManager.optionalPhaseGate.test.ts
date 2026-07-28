/**
 * Collection-install completion for a selected optional whose archive is already on disk - what a
 * resumed install produces, since reconstructModStatus maps such a member to "downloaded".
 *
 * The member sits at OPTIONAL_PHASE and fires no download event, so the trailing phase has to be
 * admitted to the walk on its own. Without that the gate stays at phase 0, nothing installs or
 * settles the member, and the install cannot complete.
 *
 * Pins both halves of the contract: the phase becomes reachable, and admitting it does not let
 * optionals overtake required members. Regression cover for LAZ-843.
 */
import { describe, expect, vi } from "vitest";

import {
  makeDownload,
  makeInstallState,
  makeMod,
  makeModInstallInfo,
  makeProfile,
  makeReference,
  makeRule,
  makeSession,
} from "../../test-utils/builders";
import type { IDriverHarnessState, IInstallManagerHarness } from "../../test-utils/harnessTypes";
import { test as imTest } from "../../test-utils/installManagerTest";
import { generateCollectionSessionId, modRuleId } from "../../util/collectionInstallSession";
import { getCollectionInstallProgress } from "../../util/collectionInstallSessionSelectors";
import { MOD_TYPE } from "../collections/constants";
import type InstallManager from "./InstallManager";
import { OPTIONAL_PHASE } from "./util/rulePhase";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const GAME = "skyrimse";
const PROFILE = "prof-1";
const COLLECTION = "col-1";

// the private phase-engine entry points the completion poll drives on every tick / on stall rescue
interface IManagerInternals {
  reQueueDownloadedMods: (
    api: unknown,
    sourceModId: string,
    allMods: unknown[],
    currentPhase: number,
  ) => void;
  checkCollectionPhaseStatus: (
    api: unknown,
    sourceModId: string,
    phase: number,
  ) => { phaseComplete: boolean; needsRequeue: boolean; allMods: unknown[] };
  driveSelectedOptionals: (api: unknown, sourceModId: string) => void;
  admitSettledOptionalPhase: (sourceModId: string, api: unknown) => void;
  pollAllPhasesComplete: (api: unknown, sourceModId: string) => Promise<void>;
  mDependencyInstalls: Record<string, () => void>;
  maybeAdvancePhase: (sourceModId: string, api: unknown) => void;
  getTerminalModCount: (api: unknown, sourceModId: string) => number;
}

const internals = (manager: InstallManager): IManagerInternals =>
  manager as unknown as IManagerInternals;

const requiredRule = makeRule({
  type: "requires",
  reference: makeReference({ tag: "req-a", gameId: GAME }),
});

// selected by the user - ignored:false is what installRecommended persists - so it counts toward
// completion, and its archive is already in the download folder
const taggedOptionalRule = makeRule({
  type: "recommends",
  reference: makeReference({ tag: "opt-a", gameId: GAME }),
  ignored: false,
});

// the same member without a reference tag, resolvable only by md5
const md5OnlyOptionalRule = makeRule({
  type: "recommends",
  reference: makeReference({ tag: undefined, gameId: GAME, fileMD5: "md5-opt-a" }),
  ignored: false,
});

/**
 * A resumed install with the required member terminal, the selected optional reconstructed as
 * "downloaded", and phase 0 complete, deployed and allowed.
 */
function makeParkedInstall(
  makeInstallManager: (overrides?: Partial<IDriverHarnessState>) => IInstallManagerHarness,
  opts: {
    optional?: "downloaded" | "pending";
    required?: "installed" | "downloaded";
    // false models a member the advance-scan cannot resolve: no reference tag, md5 only
    optionalTagged?: boolean;
    // true models a round that gathered no dependencies at all, so phase state was never set up
    uninitialisedPhase?: boolean;
  } = {},
) {
  const {
    optional: optionalStatus = "downloaded",
    required: requiredStatus = "installed",
    optionalTagged = true,
    uninitialisedPhase = false,
  } = opts;
  const optionalRule = optionalTagged ? taggedOptionalRule : md5OnlyOptionalRule;
  const sessionId = generateCollectionSessionId(COLLECTION, PROFILE);

  const h = makeInstallManager({
    profiles: { [PROFILE]: makeProfile({ id: PROFILE, gameId: GAME }) },
    mods: {
      [GAME]: {
        [COLLECTION]: makeMod({
          id: COLLECTION,
          type: MOD_TYPE,
          rules: [requiredRule, optionalRule],
          attributes: { collectionId: 1 },
        }),
        // the required member, already installed and therefore terminal
        "inst-req-a": makeMod({
          id: "inst-req-a",
          state: "installed",
          attributes: { referenceTag: "req-a", installedAsDependency: true },
        }),
      },
    },
    downloads: {
      // already on disk, so no download event will fire for it. A non-zero size matters: it is what
      // sends queueInstallation down the start-now branch rather than leaving the task pending.
      "dl-opt": makeDownload({
        id: "dl-opt",
        state: "finished",
        game: [GAME],
        size: 1024,
        localPath: "opt-a.7z",
        fileMD5: "md5-opt-a",
        modInfo: { referenceTag: "opt-a" },
      }),
    },
    session: makeInstallState({
      activeSession: makeSession({
        sessionId,
        collectionId: COLLECTION,
        profileId: PROFILE,
        gameId: GAME,
        mods: {
          [modRuleId(requiredRule)]: makeModInstallInfo({
            rule: requiredRule,
            type: "requires",
            status: requiredStatus,
            ...(requiredStatus === "installed" ? { modId: "inst-req-a" } : {}),
            phase: 0,
          }),
          // non-terminal, at the trailing phase - what a resume writes for this member
          [modRuleId(optionalRule)]: makeModInstallInfo({
            rule: optionalRule,
            type: "recommends",
            status: optionalStatus,
            phase: OPTIONAL_PHASE,
          }),
        },
        totalRequired: 1,
        totalOptional: 1,
        installedCount: 1,
        downloadedCount: 2,
      }),
    }),
  });

  h.setState((draft) => {
    draft.settings.profiles.activeProfileId = PROFILE;
  });

  // OPTIONAL_PHASE is deliberately absent from downloadsFinished: no download event adds it
  const phaseState = h.phaseTracker.ensure(COLLECTION);
  if (!uninitialisedPhase) {
    phaseState.allowedPhase = 0;
    phaseState.downloadsFinished.add(0);
    phaseState.deployedPhases.add(0);
  }

  return { h, phaseState };
}

describe("collection install completion with a selected, already-downloaded optional", () => {
  imTest(
    "every required member is terminal while the collection is not yet complete",
    async ({ makeInstallManager }) => {
      const { h } = makeParkedInstall(makeInstallManager);

      expect(internals(h.manager).getTerminalModCount(h.api, COLLECTION)).toBe(1);
      // phase 0 complete is what sends the driver to review / postprocess...
      expect(
        internals(h.manager).checkCollectionPhaseStatus(h.api, COLLECTION, 0).phaseComplete,
      ).toBe(true);
      // ...while the poll's completion gate still counts the outstanding optional
      expect(getCollectionInstallProgress(h.getState())?.isComplete).toBe(false);
    },
  );

  imTest(
    "the phase gate advances to OPTIONAL_PHASE once phase 0 is complete and deployed",
    async ({ makeInstallManager }) => {
      const { h, phaseState } = makeParkedInstall(makeInstallManager);

      // the two steps the poll runs back to back once the current phase is settled and deployed
      internals(h.manager).admitSettledOptionalPhase(COLLECTION, h.api);
      internals(h.manager).maybeAdvancePhase(COLLECTION, h.api);

      expect(phaseState.allowedPhase).toBe(OPTIONAL_PHASE);
      // stepping into the phase hands the ready archive to handleDownloadFinished, which is what
      // builds the dependency (install spec included) and queues the install. Asserted via the
      // lookup cache because only that method populates it, and unlike the pending queue it is not
      // drained the moment the install starts.
      expect(phaseState.downloadLookupCache?.byTag.get("opt-a")).toBe("dl-opt");
    },
  );

  // A round whose gather returns nothing never initialises phase state at all, so allowedPhase is
  // undefined and maybeAdvancePhase bails at "awaiting first finished phase" on every tick. Merely
  // recording the phase as downloads-finished is not enough here - admission has to initialise the
  // gate too, or the walk never starts and the install hangs until the stall timeout.
  imTest(
    "admission initialises the gate when the round gathered no dependencies",
    async ({ makeInstallManager }) => {
      const { h, phaseState } = makeParkedInstall(makeInstallManager, {
        uninitialisedPhase: true,
      });
      expect(phaseState.allowedPhase).toBeUndefined();

      const mgr = internals(h.manager);
      mgr.admitSettledOptionalPhase(COLLECTION, h.api);

      // the gate is now open AND started - without the second half the walk would bail at
      // "awaiting first finished phase" on every tick
      expect(phaseState.downloadsFinished.has(OPTIONAL_PHASE)).toBe(true);
      expect(phaseState.allowedPhase).toBe(OPTIONAL_PHASE);

      // the hand-off itself comes from the poll's requeue on the same tick (the walk pauses to
      // deploy the newly-entered phase first), so drive that too
      const status = mgr.checkCollectionPhaseStatus(h.api, COLLECTION, OPTIONAL_PHASE);
      mgr.reQueueDownloadedMods(h.api, COLLECTION, status.allMods, OPTIONAL_PHASE);
      expect(phaseState.downloadLookupCache?.byTag.get("opt-a")).toBe("dl-opt");
    },
  );

  imTest(
    "the gate does NOT reach OPTIONAL_PHASE while a required member is still outstanding",
    async ({ makeInstallManager }) => {
      const { h, phaseState } = makeParkedInstall(makeInstallManager, { required: "downloaded" });

      internals(h.manager).admitSettledOptionalPhase(COLLECTION, h.api);
      internals(h.manager).maybeAdvancePhase(COLLECTION, h.api);

      expect(phaseState.allowedPhase).toBe(0);
      // nothing was handed off for install either
      expect(phaseState.downloadLookupCache?.byTag.size).toBe(0);
    },
  );

  // maybeAdvancePhase's own hand-off scan is gated on `rule.reference?.tag` and resolves by
  // reference tag alone, so a member identified only by md5 relies on the poll's requeue backstop
  // (which matches through findDownloadForMod) to reach handleDownloadFinished.
  imTest(
    "an optional identified only by md5 still reaches the installer",
    async ({ makeInstallManager }) => {
      const { h, phaseState } = makeParkedInstall(makeInstallManager, { optionalTagged: false });
      const mgr = internals(h.manager);

      mgr.admitSettledOptionalPhase(COLLECTION, h.api);
      mgr.maybeAdvancePhase(COLLECTION, h.api);
      const status = mgr.checkCollectionPhaseStatus(
        h.api,
        COLLECTION,
        phaseState.allowedPhase ?? 0,
      );
      mgr.reQueueDownloadedMods(h.api, COLLECTION, status.allMods, phaseState.allowedPhase ?? 0);

      expect(phaseState.allowedPhase).toBe(OPTIONAL_PHASE);
      expect(phaseState.downloadLookupCache?.byMd5.get("md5-opt-a")).toBe("dl-opt");
    },
  );

  // The admission lives in the completion poll, not in maybeAdvancePhase, so the walk stays a pure
  // function of tracker state. The other tests here call the two steps directly; this one drives the
  // real poll for a single tick, so removing the call from the poll cannot pass unnoticed.
  imTest("the completion poll admits the phase on its own tick", async ({ makeInstallManager }) => {
    vi.useFakeTimers();
    try {
      const { h, phaseState } = makeParkedInstall(makeInstallManager);
      const mgr = internals(h.manager);
      // the poll bails immediately unless a dependency install is registered for the collection
      mgr.mDependencyInstalls[COLLECTION] = () => undefined;

      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);
      await vi.advanceTimersByTimeAsync(600);

      expect(phaseState.downloadsFinished.has(OPTIONAL_PHASE)).toBe(true);

      // let the poll observe a cancelled install so it resolves instead of looping forever
      delete mgr.mDependencyInstalls[COLLECTION];
      await vi.advanceTimersByTimeAsync(600);
      await polling;
    } finally {
      vi.useRealTimers();
    }
  });

  // the same member is instead downloaded by driveSelectedOptionals when it has no archive yet, so
  // the two paths together cover both statuses a selected optional can be parked at
  imTest(
    "a still-pending optional is claimed for download instead",
    async ({ makeInstallManager }) => {
      const { h } = makeParkedInstall(makeInstallManager, { optional: "pending" });

      internals(h.manager).driveSelectedOptionals(h.api, COLLECTION);

      // claimed up front, before the async gather resolves
      expect(
        h.getState().session.collections.activeSession?.mods[modRuleId(taggedOptionalRule)]?.status,
      ).toBe("downloading");
    },
  );
});
