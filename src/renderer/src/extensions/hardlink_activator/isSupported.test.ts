import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { TFunction } from "i18next";
import { expect, vi } from "vitest";

import { registerHarnessGame } from "../../test-utils/builders";
import { test, type IHarnessFixtures } from "../../test-utils/harnessTest";
import type * as fsModule from "../../util/fs";
import { getGame } from "../gamemode_management/util/getGame";
import type { IDeploymentMethod } from "../mod_management/types/IDeploymentMethod";
import type { IExtensionContextEx } from "./index";
import init from "./index";

// folders listed here report a different drive than every other folder
const otherDrive = vi.hoisted(() => new Set<string>());

vi.mock("../../util/fs", async (importOriginal) => {
  const actual = await importOriginal<typeof fsModule>();
  return {
    ...actual,
    statSync: (filePath: string) => {
      const stats = actual.statSync(filePath);
      if (otherDrive.has(filePath)) {
        stats.dev += 1;
      }
      return stats;
    },
  };
});

/** Returns the english text with its placeholders filled in, as the real translation does. */
const t = ((text: string, options?: { replace?: Record<string, string> }) =>
  text.replace(/{{(\w+)}}/g, (_match, key: string) => options?.replace?.[key] ?? "")) as TFunction;

const GAME_ID = "somegame";

/** A game folder and a staging folder on disk, with the hardlink method set up to use them. */
function setup(makeApi: IHarnessFixtures["makeApi"]) {
  const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), "vortex-hardlink-"));
  const gamePath = path.join(root, "game");
  const stagingPath = path.join(root, "staging");
  nodeFs.mkdirSync(gamePath);
  nodeFs.mkdirSync(stagingPath);

  registerHarnessGame(GAME_ID);
  const { api } = makeApi({
    discovered: { [GAME_ID]: { path: gamePath } },
    installPath: { [GAME_ID]: stagingPath },
  });
  let method: IDeploymentMethod;
  init({
    api,
    registerDeploymentMethod: (registered: IDeploymentMethod) => {
      method = registered;
    },
  } as unknown as IExtensionContextEx);

  return {
    // the harness game deploys into "mods" below the game folder
    modPath: path.join(gamePath, "mods"),
    stagingPath,
    isSupported: () => method.isSupported(api.getState(), GAME_ID, ""),
    cleanup: () => {
      otherDrive.clear();
      nodeFs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("a missing output directory is named in the reason", ({ makeApi, onTestFinished }) => {
  const h = setup(makeApi);
  onTestFinished(h.cleanup);

  expect(h.isSupported()?.description(t)).toBe(`Output directory "${h.modPath}" doesn't exist.`);
});

test("staging on another drive asks for it to be moved to the game's drive", ({
  makeApi,
  onTestFinished,
}) => {
  const h = setup(makeApi);
  onTestFinished(h.cleanup);
  nodeFs.mkdirSync(h.modPath);
  otherDrive.add(h.stagingPath);

  const reason = h.isSupported();

  expect(reason?.description(t)).toBe(
    "Works only if mods are installed on the same drive as the game.",
  );
  expect(reason?.fixCallback).toBeDefined();
});

test("staging on another drive explains that a game without symlink support has no alternative", ({
  makeApi,
  onTestFinished,
}) => {
  const h = setup(makeApi);
  onTestFinished(h.cleanup);
  nodeFs.mkdirSync(h.modPath);
  otherDrive.add(h.stagingPath);
  getGame(GAME_ID).details = { supportsSymlinks: false };

  expect(h.isSupported()?.description(t)).toBe(
    "This game doesn't support symlink deployment, and hard links work only if mods are " +
      "installed on the same drive as the game.",
  );
});
