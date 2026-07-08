import InstallContext from "../extensions/mod_management/InstallContext";
import { makeInstallContextHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IDriverHarnessState, IInstallContextHarness } from "./harnessTypes";

export interface IInstallContextFixtures {
  // build a harness around the REAL InstallContext over the given seeded slices, collecting the
  // per-mod analytics it emits
  makeInstallContext: (
    overrides?: Partial<IDriverHarnessState>,
    opts?: { gameId?: string; silent?: boolean },
  ) => IInstallContextHarness;
}

/**
 * Base test for InstallContext suites. Extends the shared harnessTest with a `makeInstallContext`
 * factory bound to the real InstallContext over the fake api, and inherits the registry/mock
 * teardown. Separate from harnessTest so only these suites pay the InstallContext import cost.
 */
export const test = harnessTest.extend<IInstallContextFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement
  makeInstallContext: async ({ task: _task }, use) => {
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use((overrides, opts) => makeInstallContextHarness(InstallContext, overrides, opts));
  },
});
