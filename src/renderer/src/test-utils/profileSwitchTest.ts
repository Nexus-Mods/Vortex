import init from "../extensions/profile_management/index";
import { makeProfileSwitchHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IProfileSwitchHarness, IProfileSwitchOpts } from "./harnessTypes";

export interface IProfileSwitchFixtures {
  // the real profile_management extension over a fake api, seeded with these profiles
  makeProfileSwitch: (opts: IProfileSwitchOpts) => Promise<IProfileSwitchHarness>;
}

/**
 * Base test for profile switch suites. Extends the shared harnessTest with a `makeProfileSwitch`
 * factory, removes the files each harness wrote on teardown, and inherits the registry/mock
 * teardown.
 */
export const test = harnessTest.extend<IProfileSwitchFixtures>({
  makeProfileSwitch: async ({ task: _task }, use) => {
    const harnesses: IProfileSwitchHarness[] = [];
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use(async (opts) => {
      const harness = await makeProfileSwitchHarness(init, opts);
      harnesses.push(harness);
      return harness;
    });
    await Promise.all(harnesses.map((harness) => harness.cleanup()));
  },
});
