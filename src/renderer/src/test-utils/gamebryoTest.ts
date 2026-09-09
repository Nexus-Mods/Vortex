import { REDUCER_BINDINGS } from "../extensions/gamebryo_plugin_management/reducers/bindings";
import type { IStateWithGamebryo } from "../extensions/gamebryo_plugin_management/types/IStateWithGamebryo";
import { transactionsReducer } from "../extensions/mod_management/reducers/transactions";
import { sessionReducer } from "../reducers/session";
import type { IState } from "../types/IState";
import { makeGameHarness, type IHarnessReducerBinding } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IGamebryoHarness, IGamebryoHarnessOpts } from "./harnessTypes";

const asGamebryo = (state: IState): IStateWithGamebryo => state as IStateWithGamebryo;

// core slices the extension's handlers read but does not own
const CORE_BINDINGS: IHarnessReducerBinding[] = [
  { path: ["persistent", "transactions"], reducer: transactionsReducer },
  { path: ["session", "base"], reducer: sessionReducer },
];

// the extension's own registrations plus the core slices above
const GAMEBRYO_BINDINGS: IHarnessReducerBinding[] = [...REDUCER_BINDINGS, ...CORE_BINDINGS];

/**
 * A gamebryo-flavoured api harness: an active profile on a gamebryo game with a staging folder
 * set, and the extension's reducers bound to the slices they own so plugin writes are observable
 * by read-back. Kept separate from harnessTest so only gamebryo suites import the extension's
 * reducers.
 */
export function makeGamebryoHarness(opts: IGamebryoHarnessOpts = {}): IGamebryoHarness {
  // seed a staging folder so the real installPath selector resolves a concrete path
  const gameId = opts.gameId ?? "skyrimse";
  const base = makeGameHarness(
    { installPath: { [gameId]: `C:/staging/${gameId}` }, ...opts },
    GAMEBRYO_BINDINGS,
  );
  return { ...base, getGamebryoState: () => asGamebryo(base.getState()) };
}

export interface IGamebryoFixtures {
  // build a gamebryo harness over the given seeded state
  makeGamebryo: (opts?: IGamebryoHarnessOpts) => IGamebryoHarness;
}

/**
 * Base test for gamebryo plugin-management suites. Extends the shared harnessTest with a
 * `makeGamebryo` factory and inherits the mock teardown.
 */
export const test = harnessTest.extend<IGamebryoFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement; the
  // provide callback is named `run` (not vitest's usual `use`) to dodge a rules-of-hooks false
  // positive on new code
  makeGamebryo: async ({ task: _task }, run) => {
    await run(makeGamebryoHarness);
  },
});
