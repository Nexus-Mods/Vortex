import { makeModChangeHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IDriverHarnessState, IModChangeHarness } from "./harnessTypes";

export interface IModChangeFixtures {
  // build a harness around the fake api with a mixpanel collector, for the mod
  // enable/disable/remove analytics (emit helpers + the real onRemoveMods)
  makeModChange: (overrides?: Partial<IDriverHarnessState>) => IModChangeHarness;
}

/**
 * Base test for the mod change (enable/disable/remove) analytics suites. Extends the shared
 * harnessTest with a `makeModChange` factory over the fake api + mixpanel collector, and inherits
 * the registry/mock teardown.
 */
export const test = harnessTest.extend<IModChangeFixtures>({
  makeModChange: async ({ task: _task }, use) => {
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use((overrides) => makeModChangeHarness(overrides));
  },
});
