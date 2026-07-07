import InstallDriver from "../extensions/collections/util/InstallDriver";
import { makeDriverHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IDriverHarness, IDriverHarnessState } from "./harnessTypes";

export interface IDriverFixtures {
  // build a harness around the REAL InstallDriver over the given seeded slices (registers a fake
  // game in the local() registry; that registration is torn down by harnessTest's autoCleanup)
  makeDriver: (overrides?: Partial<IDriverHarnessState>) => IDriverHarness;
}

/**
 * Base test for InstallDriver suites. Extends the shared harnessTest with a `makeDriver` factory
 * bound to the real InstallDriver, and inherits `makeApi` + the registry/mock teardown. This is a
 * separate module from harnessTest on purpose: it imports the (slow) InstallDriver, so only driver
 * suites pay that cost - api-only suites keep importing harnessTest directly.
 */
export const test = harnessTest.extend<IDriverFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement; this
  // fixture depends on no other fixture
  makeDriver: async ({ task: _task }, use) => {
    await use((overrides?: Partial<IDriverHarnessState>) =>
      makeDriverHarness(InstallDriver, overrides),
    );
  },
});
