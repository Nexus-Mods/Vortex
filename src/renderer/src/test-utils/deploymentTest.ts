import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import hardlinkInit from "../extensions/hardlink_activator";
import type {
  IDeployedFile,
  IDeploymentMethod,
} from "../extensions/mod_management/types/IDeploymentMethod";
import BlacklistSet from "../extensions/mod_management/util/BlacklistSet";
import moveInit from "../extensions/move_activator";
import symlinkInit from "../extensions/symlink_activator";
import type { IGame } from "../types/IGame";
import type { Normalize } from "../util/getNormalizeFunc";
import {
  makeApiHarness,
  makeBlacklistGame,
  makeRealDeploymentMethod,
  registerHarnessGame,
  type IHarnessReducerBinding,
} from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IApiHarness, IDriverHarnessState } from "./harnessTypes";

const METHOD_INIT = {
  hardlink: hardlinkInit,
  symlink: symlinkInit,
  move: moveInit,
} as const;

export type DeploymentMethodName = keyof typeof METHOD_INIT;

export interface IDeploymentHarness extends IApiHarness {
  method: IDeploymentMethod;
  /** the game's data folder, holding the links */
  gameDir: string;
  /** the folder holding the staged mods */
  stagingDir: string;
  /** prepare + activate + finalize against the seeded mod */
  deploy: (lastDeployment?: IDeployedFile[]) => Promise<IDeployedFile[]>;
  /** prepare + activate + finalize against one of the seeded mods */
  deployMod: (modName: string, lastDeployment?: IDeployedFile[]) => Promise<IDeployedFile[]>;
  /** a full deployment, as deploying all mods does: later mods win conflicts */
  deployAll: (modNames: string[], lastDeployment?: IDeployedFile[]) => Promise<IDeployedFile[]>;
  /** prepare + deactivate + finalize against the seeded mod, as removing it does */
  remove: (lastDeployment: IDeployedFile[]) => Promise<IDeployedFile[]>;
  modDir: (modName: string) => string;
  /** the game the skip list reads `details.ignoreDeploy` from */
  game: IGame;
  inGame: (relPath: string) => string;
  /** the primary mod's relative paths currently present in the game folder */
  deployedFiles: () => string[];
  /** manifest listing every file of the primary mod, at the given deploy time */
  manifest: (time?: number) => IDeployedFile[];
  normalize: Normalize;
  /** answer to the "File busy" retry dialog */
  setBusyDialogAnswer: (answer: "cancel" | "retry") => void;
  /** make a deployed file's unlink fail, by putting a directory in its place */
  blockUnlink: (relPath: string) => void;
}

export interface IDeploymentOptions extends Partial<IDriverHarnessState> {
  /** relPath -> content */
  files: Record<string, string>;
  method?: DeploymentMethodName;
  modName?: string;
  /** more mods in the same staging folder: modName -> relPath -> content */
  otherMods?: Record<string, Record<string, string>>;
  gameId?: string;
  extraReducers?: IHarnessReducerBinding[];
  /** each mod deploys into a folder named after it, as for games that don't merge mods (mergeMods off) */
  modFolders?: boolean;
  /** how the deployment folder's paths compare; upper-case by default, as on Windows */
  normalize?: Normalize;
}

/**
 * Harness around one of the real deployment methods over a real temporary filesystem: mod
 * files in a staging folder and the game folder it deploys into, both under one temp root
 * so hardlinks stay on one volume.
 */
export function makeDeploymentHarness(
  options: IDeploymentOptions,
): IDeploymentHarness & { cleanup: () => void } {
  const gameId = options.gameId ?? "skyrimse";
  const modName = options.modName ?? "SomeMod";
  const subDir = (name: string) => (options.modFolders === true ? name : "");
  const base = makeApiHarness(options, options.extraReducers);
  registerHarnessGame(gameId);

  const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), "vortex-deploy-"));
  const gameDir = path.join(root, "game", "Data");
  const stagingDir = path.join(root, "staging");
  const modDir = (name: string) => path.join(stagingDir, name);
  nodeFs.mkdirSync(gameDir, { recursive: true });

  const relPaths = Object.keys(options.files);
  const seedMod = (name: string, files: Record<string, string>) => {
    nodeFs.mkdirSync(modDir(name), { recursive: true });
    for (const relPath of Object.keys(files)) {
      const source = path.join(modDir(name), relPath);
      nodeFs.mkdirSync(path.dirname(source), { recursive: true });
      nodeFs.writeFileSync(source, files[relPath]);
    }
  };
  seedMod(modName, options.files);
  for (const [name, files] of Object.entries(options.otherMods ?? {})) {
    seedMod(name, files);
  }

  const method = makeRealDeploymentMethod(base.api, METHOD_INIT[options.method ?? "hardlink"]);

  let busyAnswer: "cancel" | "retry" = "cancel";
  window.api = {
    ...window.api,
    // buttons are ["Cancel", "Retry"]
    dialog: {
      ...window.api.dialog,
      showMessageBox: async () => ({
        response: busyAnswer === "cancel" ? 0 : 1,
        checkboxChecked: false,
      }),
    },
  };

  const normalize: Normalize = options.normalize ?? ((input: string) => input.toUpperCase());
  const game = makeBlacklistGame();
  const blacklist = new BlacklistSet([], game, normalize);

  const deployMod = async (name: string, lastDeployment: IDeployedFile[] = []) => {
    await method.prepare(gameDir, false, lastDeployment, normalize);
    await method.activate(modDir(name), name, subDir(name), blacklist);
    return method.finalize(gameId, gameDir, stagingDir);
  };
  const inGame = (relPath: string) => path.join(gameDir, subDir(modName), relPath);

  return {
    ...base,
    method,
    gameDir,
    stagingDir,
    deploy: (lastDeployment: IDeployedFile[] = []) => deployMod(modName, lastDeployment),
    deployMod,
    deployAll: async (modNames: string[], lastDeployment: IDeployedFile[] = []) => {
      await method.prepare(gameDir, true, lastDeployment, normalize);
      for (const name of modNames) {
        await method.activate(modDir(name), name, subDir(name), blacklist);
      }
      return method.finalize(gameId, gameDir, stagingDir);
    },
    remove: async (lastDeployment: IDeployedFile[]) => {
      await method.prepare(gameDir, false, lastDeployment, normalize);
      await method.deactivate(modDir(modName), subDir(modName), modName);
      return method.finalize(gameId, gameDir, stagingDir);
    },
    modDir,
    game,
    inGame,
    deployedFiles: () =>
      relPaths.filter(
        (rel) => nodeFs.statSync(inGame(rel), { throwIfNoEntry: false })?.isFile() === true,
      ),
    manifest: (time = 1) =>
      relPaths.map((relPath) => ({ relPath, source: modName, target: subDir(modName), time })),
    normalize,
    setBusyDialogAnswer: (answer) => {
      busyAnswer = answer;
    },
    blockUnlink: (relPath: string) => {
      const deployedPath = inGame(relPath);
      nodeFs.unlinkSync(deployedPath);
      nodeFs.mkdirSync(deployedPath);
      nodeFs.writeFileSync(path.join(deployedPath, "occupied"), "");
    },
    cleanup: () => {
      nodeFs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    },
  };
}

export interface IDeploymentFixtures {
  makeDeployment: (options: IDeploymentOptions) => IDeploymentHarness;
}

/**
 * Base test for deployment-method suites. Extends harnessTest with a `makeDeployment`
 * factory, adding removal of the temp filesystem to the inherited teardown.
 */
export const test = harnessTest.extend<IDeploymentFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement
  makeDeployment: async ({ task: _task }, use) => {
    const cleanups: Array<() => void> = [];
    await use((options: IDeploymentOptions) => {
      const harness = makeDeploymentHarness(options);
      cleanups.push(harness.cleanup);
      return harness;
    });
    cleanups.forEach((fn) => fn());
  },
});
