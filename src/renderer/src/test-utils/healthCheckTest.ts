import { HealthCheckRegistry } from "../extensions/health_check/core/HealthCheckRegistry";
import { makeHealthCheckHarness } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IHealthCheckHarness, IHealthCheckHarnessOpts } from "./harnessTypes";

export interface IHealthCheckFixtures {
  // build a harness around the real HealthCheckRegistry and the fake api
  makeHealthCheck: (opts?: IHealthCheckHarnessOpts) => IHealthCheckHarness;
}

/**
 * Base test for HealthCheckRegistry scheduling suites. Extends the shared harnessTest with a
 * `makeHealthCheck` factory over the real registry, and releases every parked check body on
 * teardown. That teardown is what makes this a fixture rather than a bare builder: a parked body
 * outlives the run that started it, and must not tick on into the next test.
 */
export const test = harnessTest.extend<IHealthCheckFixtures>({
  makeHealthCheck: async ({ task: _task }, use) => {
    const built: IHealthCheckHarness[] = [];
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use((opts) => {
      const harness = makeHealthCheckHarness(HealthCheckRegistry, opts);
      built.push(harness);
      return harness;
    });
    for (const harness of built) {
      await harness.releaseParked();
    }
  },
});
