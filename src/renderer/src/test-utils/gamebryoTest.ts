import { loadOrderReducer } from "../extensions/gamebryo_plugin_management/reducers/loadOrder";
import { pluginsReducer } from "../extensions/gamebryo_plugin_management/reducers/plugins";
import type { IStateWithGamebryo } from "../extensions/gamebryo_plugin_management/types/IStateWithGamebryo";
import type { IState } from "../types/IState";
import { makeGameHarness, type IHarnessReducerBinding } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IGamebryoHarness, IGamebryoHarnessOpts } from "./harnessTypes";

const asGamebryo = (state: IState): IStateWithGamebryo => state as IStateWithGamebryo;

// the extension's reducer specs, bound to the slices they own (the root loadOrder hive and
// session.plugins); the harness seeds each from its spec's defaults
const GAMEBRYO_BINDINGS: IHarnessReducerBinding[] = [
  {
    spec: loadOrderReducer,
    read: (state) => asGamebryo(state).loadOrder,
    write: (state, slice) => {
      asGamebryo(state).loadOrder = slice as IStateWithGamebryo["loadOrder"];
    },
  },
  {
    spec: pluginsReducer,
    read: (state) => asGamebryo(state).session.plugins ?? {},
    write: (state, slice) => {
      asGamebryo(state).session.plugins = slice as IStateWithGamebryo["session"]["plugins"];
    },
  },
];

/**
 * A gamebryo-flavoured api harness: an active profile on a gamebryo game with a staging folder
 * set, and the extension's reducers bound to the slices they own so plugin writes are observable
 * by read-back. Kept separate from harnessTest so only gamebryo suites import the extension's
 * reducers.
 */
export function makeGamebryoHarness(opts: IGamebryoHarnessOpts = {}): IGamebryoHarness {
  const base = makeGameHarness(opts, GAMEBRYO_BINDINGS);
  base.setState((draft) => {
    // so the real installPath selector resolves a concrete staging folder
    draft.settings.mods.installPath[base.gameId] = `C:/staging/${base.gameId}`;
  });
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
