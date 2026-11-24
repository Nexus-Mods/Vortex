import { type ElectronRelease, type NpmPackument } from "./schemas";
import { newestNodeAbi, newestRelease } from "./select";
import { type Pins } from "./workspace";

/** A version change. */
export interface Change {
  from: string;
  to: string;
}

/** What an upgrade will change. */
export interface Plan {
  electron: Change;
  node: Change;
  /** Set when the installed node-abi does not know the target Electron. */
  nodeAbi: Change | undefined;
}

/** Everything the planner needs from the outside world. */
export interface PlanDeps {
  fetchReleases(): Promise<ElectronRelease[]>;
  fetchNodeAbiPackument(): Promise<NpmPackument>;
  /** Whether the installed node-abi can resolve the ABI of this Electron version. */
  abiKnown(electronVersion: string): Promise<boolean>;
  now(): number;
}

/**
 * Decides what to upgrade, or returns undefined when everything is current.
 *
 * The target is the newest eligible Electron release; when there is none, the
 * current Electron is still the target if its bundled Node.js differs from the
 * pin (drift). When node-abi does not know the target it is bumped to its
 * newest eligible release; the plan fails if there is none.
 */
export const planUpgrade = async (pins: Pins, deps: PlanDeps): Promise<Plan | undefined> => {
  const releases = await deps.fetchReleases();
  const now = deps.now();

  let target = newestRelease(releases, pins.electron, pins.minReleaseAgeMs, now);
  if (target === undefined) {
    const own = releases.find((release) => release.version === pins.electron);
    if (own === undefined) {
      throw new Error(`Electron ${pins.electron} is not listed in the Electron releases`);
    }
    if (own.node === pins.node) {
      return undefined;
    }
    target = own;
  }

  let nodeAbi: Change | undefined;
  if (!(await deps.abiKnown(target.version))) {
    const to = newestNodeAbi(
      await deps.fetchNodeAbiPackument(),
      pins.nodeAbi,
      pins.minReleaseAgeMs,
      now,
    );
    if (to === undefined) {
      throw new Error(
        `node-abi ${pins.nodeAbi} does not know Electron ${target.version} and no newer node-abi is available`,
      );
    }
    nodeAbi = { from: pins.nodeAbi, to };
  }

  return {
    electron: { from: pins.electron, to: target.version },
    node: { from: pins.node, to: target.node },
    nodeAbi,
  };
};
