/**
 * Owns InstallManager's per-collection phase-gating state: the bookkeeping that decides which
 * install phase may run, which phases have finished downloading / been deployed, and the per-phase
 * pending/active task accounting. Extracted from InstallManager so this fiddly, in-memory-only state
 * has a single owner that can be reasoned about and tested apart from the install orchestration. The
 * orchestration stays in InstallManager and reaches a collection's entry through ensure()/get().
 */
import type { IModRule } from "../types/IMod";
import { collectionRulePhases } from "./rulePhase";

/** A scheduled per-phase deployment and whether it should redeploy once the phase settles. */
export interface IDeploymentDetails {
  deploymentPromise: Promise<void>;
  deployOnSettle: boolean;
}

/** The phase-gating state for one collection install (keyed in the tracker by its source mod id). */
export interface IInstallPhaseEntry {
  allowedPhase?: number;
  downloadsFinished: Set<number>;
  pendingByPhase: Map<number, Array<() => void>>;
  activeByPhase: Map<number, number>;
  deployedPhases: Set<number>;
  reQueueAttempted?: Map<number, number>;
  deploymentPromises?: Map<number, IDeploymentDetails>;
  // set while a phase deployment is in progress, to hold off starting new installers
  isDeploying?: boolean;
  // cache of finished downloads by reference tag / md5, to avoid an O(n*m) scan
  downloadLookupCache?: {
    byTag: Map<string, string>;
    byMd5: Map<string, string>;
  };
  // the collection's distinct install phases (ascending), computed once per session (see phaseSet)
  phaseSet?: number[];
}

export class InstallPhaseTracker {
  // keyed by source mod id (the collection mod whose dependencies are installing)
  private readonly mPhases = new Map<string, IInstallPhaseEntry>();

  /** The phase entry for a collection, creating an empty one if it does not exist yet. */
  public ensure(sourceModId: string): IInstallPhaseEntry {
    let entry = this.mPhases.get(sourceModId);
    if (entry === undefined) {
      entry = {
        allowedPhase: undefined,
        downloadsFinished: new Set<number>(),
        pendingByPhase: new Map<number, Array<() => void>>(),
        activeByPhase: new Map<number, number>(),
        deployedPhases: new Set<number>(),
        deploymentPromises: new Map<number, IDeploymentDetails>(),
        downloadLookupCache: {
          byTag: new Map<string, string>(),
          byMd5: new Map<string, string>(),
        },
      };
      this.mPhases.set(sourceModId, entry);
    }
    return entry;
  }

  public get(sourceModId: string): IInstallPhaseEntry | undefined {
    return this.mPhases.get(sourceModId);
  }

  public has(sourceModId: string): boolean {
    return this.mPhases.has(sourceModId);
  }

  public delete(sourceModId: string): void {
    this.mPhases.delete(sourceModId);
  }

  /**
   * The collection's distinct install phases (ascending), memoized on the entry. Safe to cache for
   * the whole session: rulePhase keys off a rule's type/phase, not its ignored flag, so
   * ignore/unignore never changes the set, and the rule set does not change mid-install. Avoids an
   * O(rules) rescan on every queued install / phase-finish.
   */
  public phaseSet(sourceModId: string, rules: IModRule[]): number[] {
    const entry = this.ensure(sourceModId);
    if (entry.phaseSet === undefined) {
      entry.phaseSet = collectionRulePhases(rules);
    }
    return entry.phaseSet;
  }

  /**
   * Mark every real collection phase that sorts before `target` as downloads-finished. Replaces the
   * old `for (p = 0; p < target; p++)` backfill, which would enumerate up to the OPTIONAL_PHASE
   * sentinel and pollute downloadsFinished with phantom phases the advancer would try to deploy.
   */
  public markPhasesBeforeFinished(sourceModId: string, target: number, rules: IModRule[]): void {
    const entry = this.ensure(sourceModId);
    this.phaseSet(sourceModId, rules).forEach((p) => {
      if (p < target) {
        entry.downloadsFinished.add(p);
      }
    });
  }
}
