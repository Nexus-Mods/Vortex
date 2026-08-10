import UpdateSet from "../extensions/file_based_loadorder/UpdateSet";
import { makeFbloHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IFbloHarness, IFbloHarnessOpts } from "./harnessTypes";

export interface IFbloFixtures {
  // build a file-based load order harness (fake api + UpdateSet) over the given seeded state
  makeFblo: (opts?: IFbloHarnessOpts) => IFbloHarness;
}

/**
 * Base test for file-based load order suites. Extends the shared harnessTest with a `makeFblo`
 * factory bound to the real UpdateSet, and inherits the mock teardown. Kept separate from
 * harnessTest so only FBLO suites import UpdateSet.
 */
export const test = harnessTest.extend<IFbloFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement
  makeFblo: async ({ task: _task }, use) => {
    await use((opts?: IFbloHarnessOpts) => makeFbloHarness(UpdateSet, opts));
  },
});
