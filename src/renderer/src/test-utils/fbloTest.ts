import { LoadOrderRegistry } from "../extensions/file_based_loadorder/gameSupport";
import { registerLoadOrderHandlers } from "../extensions/file_based_loadorder/handlers";
import { REDUCER_BINDINGS } from "../extensions/file_based_loadorder/reducers/bindings";
import { loadOrderForProfile } from "../extensions/file_based_loadorder/selectors";
import { profilesReducer } from "../extensions/profile_management/reducers/profiles";
import { sessionReducer } from "../reducers/session";
import { makeGameHarness, makeLoadOrderGameInfo, type IHarnessReducerBinding } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IFbloHarness, IFbloHarnessOpts } from "./harnessTypes";

// the extension's own registrations plus the core slices its reducers and handlers react to
const FBLO_BINDINGS: IHarnessReducerBinding[] = [
  ...REDUCER_BINDINGS,
  { path: ["persistent", "profiles"], reducer: profilesReducer },
  { path: ["session", "base"], reducer: sessionReducer },
];

/**
 * A file-based load order harness: the extension's reducers, handlers and a registry over an
 * active profile. Kept separate from harnessTest so only FBLO suites import the extension.
 */
export function makeFbloHarness(opts: IFbloHarnessOpts = {}): IFbloHarness {
  const base = makeGameHarness(opts, FBLO_BINDINGS);
  const registry = new LoadOrderRegistry();
  registerLoadOrderHandlers(base.api, registry);
  return {
    ...base,
    registerLoadOrder: (overrides = {}) =>
      registry.addInline(makeLoadOrderGameInfo({ gameId: base.gameId, ...overrides })),
    loadOrder: (loadOrderId?: string) =>
      loadOrderForProfile(base.getState(), base.profileId, loadOrderId),
  };
}

export interface IFbloFixtures {
  // build a file-based load order harness over the given seeded state
  makeFblo: (opts?: IFbloHarnessOpts) => IFbloHarness;
}

/**
 * Base test for file-based load order suites. Extends the shared harnessTest with a `makeFblo`
 * factory and inherits the mock teardown.
 */
export const test = harnessTest.extend<IFbloFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement; the
  // provide callback is named `run` (not vitest's usual `use`) to dodge a rules-of-hooks false
  // positive on new code
  makeFblo: async ({ task: _task }, run) => {
    await run(makeFbloHarness);
  },
});
