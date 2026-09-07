import * as nodeFs from "node:fs";

import PromiseBB from "bluebird";
import { vi } from "vitest";

import { setAttributeFilter, setAttributeVisible } from "../../../src/renderer/src/actions/tables";
import { removeMod } from "../../../src/renderer/src/extensions/mod_management/actions/mods";
import renderModName from "../../../src/renderer/src/extensions/mod_management/util/modName";
import { ProcessCanceled, UserCanceled } from "../../../src/renderer/src/util/CustomErrors";
import { deleteOrNop, getSafe, setSafe } from "../../../src/renderer/src/util/storeHelper";
import { batchDispatch, makeOverlayableDictionary } from "../../../src/renderer/src/util/util";

/**
 * Test-time stand-in for `@nexusmods/vortex-api`, resolved via the alias in
 * vitest.config.ts (the real package is types-only outside the bundled app). It lives
 * outside src/ so tsc never typechecks it against the extension project - test code
 * keeps importing `@nexusmods/vortex-api` and gets the real package's types while
 * vitest serves this module at runtime. Pure pieces re-export the actual renderer
 * implementations; environment-dependent surfaces (fs, selectors, log) are vitest
 * doubles that the `vortexApiTest` fixture owns and resets.
 */

// real node-fs behavior wrapped in Bluebird (production code relies on Bluebird's
// predicate .catch and chains .filter on readdirAsync). readdirAsync is a vi.fn whose
// default reads the real directory; suites arrange it per-case to override, and
// mockReset restores this default. utimesAsync returns a native promise: its only
// consumer uses a plain .catch.
export const fs = {
  readdirAsync: vi.fn((dirPath: string) => PromiseBB.resolve(nodeFs.promises.readdir(dirPath))),
  ensureDirAsync: (dirPath: string) =>
    PromiseBB.resolve(nodeFs.promises.mkdir(dirPath, { recursive: true })).then(() => undefined),
  readFileAsync: (filePath: string, options?: { encoding?: BufferEncoding }) =>
    PromiseBB.resolve(nodeFs.promises.readFile(filePath, options)),
  statAsync: (filePath: string) => PromiseBB.resolve(nodeFs.promises.stat(filePath)),
  utimesAsync: (filePath: string, atime: number, mtime: number) =>
    nodeFs.promises.utimes(filePath, atime, mtime),
  // inert: a real OS watcher takes the worker process down on Windows CI, and nothing here
  // drives the persistor through fs events - the tests trigger its reads directly
  watch: () => ({ on: () => undefined, close: () => undefined }) as unknown as nodeFs.FSWatcher,
  writeFileAsync: (filePath: string, data: string | Buffer, options?: { encoding?: string }) =>
    PromiseBB.resolve(
      nodeFs.promises.writeFile(filePath, data, options as { encoding?: BufferEncoding }),
    ),
};

export const selectors = {
  activeGameId: vi.fn(),
  activeProfile: vi.fn(),
  getCollectionActiveSession: vi.fn(),
  installPath: vi.fn(),
};

export const log = vi.fn();

export const actions = {
  removeMod,
  setAttributeFilter,
  setAttributeVisible,
};

export const util = {
  ProcessCanceled,
  UserCanceled,
  batchDispatch,
  deleteOrNop,
  getSafe,
  makeOverlayableDictionary,
  renderModName,
  setSafe,
};

// only ever used in type positions; the named binding just has to exist at runtime
export const types = {};
