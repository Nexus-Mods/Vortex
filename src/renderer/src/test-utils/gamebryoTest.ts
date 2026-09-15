import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { onTestFinished, vi } from "vitest";

import { setPluginList } from "../extensions/gamebryo_plugin_management/actions/plugins";
import type LootInterface from "../extensions/gamebryo_plugin_management/autosort";
import { createLootMock, seams } from "../extensions/gamebryo_plugin_management/lootMocks";
import { REDUCER_BINDINGS } from "../extensions/gamebryo_plugin_management/reducers/bindings";
import type { IPluginsLoot } from "../extensions/gamebryo_plugin_management/types/IPlugins";
import type { IStateWithGamebryo } from "../extensions/gamebryo_plugin_management/types/IStateWithGamebryo";
import toPluginId from "../extensions/gamebryo_plugin_management/util/toPluginId";
import { transactionsReducer } from "../extensions/mod_management/reducers/transactions";
import { sessionReducer } from "../reducers/session";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IState } from "../types/IState";
import { makeFakeLoot, makeGameHarness, makePlugin, type IHarnessReducerBinding } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type {
  IGamebryoHarness,
  IGamebryoHarnessOpts,
  ILootHarness,
  ILootHarnessOpts,
} from "./harnessTypes";
import { makeTempDir } from "./tempDir";

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
  const base = makeGameHarness(opts, GAMEBRYO_BINDINGS);
  const getGamebryoState = () => asGamebryo(base.getState());
  return {
    ...base,
    getGamebryoState,
    pluginList: () => getGamebryoState().session.plugins.pluginList,
  };
}

/** Write a stub plugin file (the scans only stat it or sniff its magic) and return its path. */
export async function writePluginFile(dir: string, name: string): Promise<string> {
  const filePath = path.join(dir, name);
  await writeFile(filePath, "TES4");
  return filePath;
}

/** Create a directory holding stub plugin files with the given names; returns the directory. */
export async function seedPluginDir(dir: string, names: string[]): Promise<string> {
  await mkdir(dir, { recursive: true });
  await Promise.all(names.map((name) => writePluginFile(dir, name)));
  return dir;
}

/**
 * A gamebryo harness plus a LootInterface constructed against it, awaited through its init: fresh
 * temp vortex paths with the game's masterlist.yaml in place (so init loads lists cleanly) and a
 * fresh fake loot behind the lootMocks seams (torn down when the test finishes). Mock call
 * records are cleared after init so tests assert only their own traffic - so arrange mocks after
 * building the harness. Requires the suite to vi.mock the five modules the lootMocks replacements
 * cover; the ctor is passed in (like makeFbloHarness) to keep the autosort import out of this
 * module.
 */
export async function makeLootHarness(
  LootCtor: new (api: IExtensionApi) => LootInterface,
  opts: ILootHarnessOpts = {},
): Promise<ILootHarness> {
  const { initError, invalidPlugins, ...gamebryoOpts } = opts;
  const gameId = gamebryoOpts.gameId ?? "skyrimse";

  const tempDir = await makeTempDir("vortex-loot-");
  onTestFinished(() => {
    seams.loot = undefined;
  });
  seams.base = tempDir;
  seams.gameId = gameId;
  seams.invalid = invalidPlugins ?? [];
  seams.loot = makeFakeLoot();

  const masterlistDir = path.join(tempDir, "userData", gameId, "masterlist");
  const dataDir = path.join(tempDir, "data");
  await Promise.all([
    mkdir(masterlistDir, { recursive: true }),
    mkdir(dataDir, { recursive: true }),
  ]);
  await writeFile(path.join(masterlistDir, "masterlist.yaml"), "");

  if (initError !== undefined) {
    createLootMock.mockRejectedValueOnce(initError);
  }

  const base = makeGamebryoHarness({ ...gamebryoOpts, gameId });
  const lootInterface = new LootCtor(base.api);
  await lootInterface.wait();

  // drop the init traffic (createAsync, one loadListsAsync, the masterlist download)
  vi.clearAllMocks();

  const addPluginFile = (name: string): Promise<string> => writePluginFile(dataDir, name);

  return {
    ...base,
    loot: seams.loot,
    lootInterface,
    addPluginFile,
    seedPlugins: async (specs) => {
      const entries = await Promise.all(
        specs.map(async (spec) => {
          const { name, ...overrides } = typeof spec === "string" ? { name: spec } : spec;
          // an explicit filePath override keeps the harness from backing the plugin with a file
          const filePath = overrides.filePath ?? (await addPluginFile(name));
          return [toPluginId(name), makePlugin({ ...overrides, filePath })] as const;
        }),
      );
      base.api.store.dispatch(setPluginList(Object.fromEntries(entries)));
    },
    userlistPath: path.join(tempDir, "userData", gameId, "userlist.yaml"),
    dataDir,
    sort: (manual: boolean) =>
      new Promise((resolve) => {
        base.emit("autosort-plugins", manual, (err: Error | null) => resolve(err));
      }),
    requestDetails: (plugins: string[]) =>
      new Promise((resolve) => {
        base.emit("plugin-details", gameId, plugins, (result: IPluginsLoot) => resolve(result));
      }),
    restartHelpers: () => {
      base.emit("restart-helpers");
    },
  };
}

export interface IGamebryoFixtures {
  // build a gamebryo harness over the given seeded state
  makeGamebryo: (opts?: IGamebryoHarnessOpts) => IGamebryoHarness;
  // build a gamebryo harness with a LootInterface driven through init (temp dirs torn down after)
  makeLoot: (
    LootCtor: new (api: IExtensionApi) => LootInterface,
    opts?: ILootHarnessOpts,
  ) => Promise<ILootHarness>;
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
  makeLoot: async ({ task: _task }, run) => {
    await run(makeLootHarness);
  },
});
