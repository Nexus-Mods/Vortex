import { test as base, vi } from "vitest";

import { makeApiHarness, resetHarnessRegistries } from "./builders";
import type { IApiHarness, IDriverHarnessState } from "./harnessTypes";

export interface IHarnessFixtures {
  // build an api-only harness over the given seeded slices (no driver, no game registration)
  makeApi: (overrides?: Partial<IDriverHarnessState>) => IApiHarness;
}

/**
 * Shared base test for harness-driven suites. An AUTOMATIC fixture clears the worker-global game
 * registries (which makeDriverHarness populates) and mock state after every test - so a fake game
 * registered by one test can never leak into the next, and it runs even for tests that build a
 * harness directly (replacing a hand-written afterEach that such a test could bypass). Suites that
 * need the real InstallDriver extend this with their own driver fixture, keeping the slow driver
 * import out of api-only suites.
 *
 * The fixtures destructure the built-in `task` fixture (as the unused `_task`) only because
 * vitest requires the fixture context to be an object-destructuring pattern; they depend on no
 * other fixture.
 */
export const test = base.extend<IHarnessFixtures & { autoCleanup: void }>({
  autoCleanup: [
    async ({ task: _task }, use) => {
      await use();
      resetHarnessRegistries();
      vi.clearAllMocks();
    },
    { auto: true },
  ],
  makeApi: async ({ task: _task }, use) => {
    await use((overrides?: Partial<IDriverHarnessState>) => makeApiHarness(overrides));
  },
});
