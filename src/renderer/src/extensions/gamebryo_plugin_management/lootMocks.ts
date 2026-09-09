/**
 * The vi.mock replacement modules for the LootInterface (autosort) suites, backed by mutable
 * seams that test-utils/gamebryoTest.makeLootHarness arranges per test.
 *
 * TODO LAZ-1037: the decomposition moves the modules mocked here, so the replacement objects and
 * the vi.mock paths in the autosort suites have to follow it.
 */
import * as path from "node:path";

import { vi } from "vitest";

import type { IFakeLoot } from "../../test-utils/harnessTypes";
import type { IPlugins } from "./types/IPlugins";

interface ILootSeams {
  // getVortexPath root for the current test (a per-test temp dir)
  base: string;
  // the harness game, the one gameSupported answers true for
  gameId: string;
  // the plugin names findInvalidPlugins reports as invalid
  invalid: string[];
  // the loot instance createAsync resolves; makeLootHarness arranges a fresh fake per test
  loot: IFakeLoot | undefined;
}

/** The mutable state behind the mocked modules; makeLootHarness resets it per test. */
export const seams: ILootSeams = {
  base: "",
  gameId: "",
  invalid: [],
  loot: undefined,
};

/** Resolves the current fake loot; reject once to drive the init-failure path. */
export const createLootMock = vi.fn<() => Promise<IFakeLoot>>(() =>
  seams.loot === undefined
    ? Promise.reject(new Error("no fake loot arranged - build the harness through makeLoot"))
    : Promise.resolve(seams.loot),
);

// ../../util/webpack-hacks: the raw-require seam autosort loads the loot binding through
export const webpackHacksModule = {
  webpackRequireHack: () => ({ LootAsync: { createAsync: createLootMock } }),
};

// ../../util/getVortexPath: every vortex path keyed under the per-test temp root
export const getVortexPathModule = {
  default: (key: string) => path.join(seams.base, key),
};

// ./util/gameSupport: consults a module-level api handle set at extension init; pin the answers
export const gameSupportModule = {
  gameSupported: (gameMode: string) => gameMode === seams.gameId,
  pluginPath: (gameMode: string) => path.join(seams.base, "local", gameMode),
  gameDataPath: () => path.join(seams.base, "data"),
  nativePlugins: () => [] as string[],
};

export const downloadMasterlistMock = vi.fn<(gameId: string, localPath: string) => Promise<void>>(
  () => Promise.resolve(),
);
export const downloadPreludeMock = vi.fn<(localPath: string) => Promise<void>>(() =>
  Promise.resolve(),
);
// ./util/masterlist: no live masterlist downloads in tests
export const masterlistModule = {
  downloadMasterlist: downloadMasterlistMock,
  downloadPrelude: downloadPreludeMock,
};

export const findInvalidPluginsMock = vi.fn<
  (pluginIds: string[], pluginList: IPlugins, gameMode: string) => Promise<Set<string>>
>(() => Promise.resolve(new Set(seams.invalid)));
// ./util/findInvalidPlugins: header parsing has its own suite; the answer is arranged here
export const invalidPluginsModule = { findInvalidPlugins: findInvalidPluginsMock };
