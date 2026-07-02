import InstallManager from "../extensions/mod_management/InstallManager";
import { makeInstallManagerHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IDriverHarnessState, IInstallManagerHarness } from "./harnessTypes";

export interface IInstallManagerFixtures {
  // build a harness around the REAL InstallManager over the given seeded slices (registers a fake
  // game in the local() registry; that registration is torn down by harnessTest's autoCleanup)
  makeInstallManager: (overrides?: Partial<IDriverHarnessState>) => IInstallManagerHarness;
}

/**
 * Base test for InstallManager suites. Extends the shared harnessTest with a `makeInstallManager`
 * factory bound to the real InstallManager over the fake api, and inherits `makeApi` + the
 * registry/mock teardown. Separate from harnessTest on purpose: it imports the (slow) InstallManager,
 * so only manager suites pay that cost.
 */
export const test = harnessTest.extend<IInstallManagerFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement; this
  // fixture depends on no other fixture
  makeInstallManager: async ({ task: _task }, use) => {
    await use((overrides?: Partial<IDriverHarnessState>) =>
      makeInstallManagerHarness(InstallManager, overrides),
    );
  },
});
