import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { IExtensionContextEx } from "../extensions/hardlink_activator";
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
import { makeApiHarness, registerHarnessGame } from "./builders";
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
  inGame: (relPath: string) => string;
  /** relative paths currently present in the game folder */
  deployedFiles: () => string[];
  /** manifest listing every seeded file, at the given deploy time */
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
  gameId?: string;
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
  const base = makeApiHarness(options);
  registerHarnessGame(gameId);

  const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), "vortex-deploy-"));
  const gameDir = path.join(root, "game", "Data");
  const stagingDir = path.join(root, "staging");
  const modDir = path.join(stagingDir, modName);
  nodeFs.mkdirSync(gameDir, { recursive: true });
  nodeFs.mkdirSync(modDir, { recursive: true });

  const relPaths = Object.keys(options.files);
  for (const relPath of relPaths) {
    const source = path.join(modDir, relPath);
    nodeFs.mkdirSync(path.dirname(source), { recursive: true });
    nodeFs.writeFileSync(source, options.files[relPath]);
  }

  let method: IDeploymentMethod;
  const context: Partial<IExtensionContextEx> = {
    api: base.api,
    registerDeploymentMethod: (m: IDeploymentMethod) => {
      method = m;
    },
  };
  METHOD_INIT[options.method ?? "hardlink"](context as IExtensionContextEx);

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

  const normalize: Normalize = (input: string) => input.toLowerCase();
  // BlacklistSet only reads game.details?.ignoreDeploy
  const blacklist = new BlacklistSet([], { details: {} } as unknown as IGame, normalize);

  return {
    ...base,
    method,
    gameDir,
    stagingDir,
    deploy: async (lastDeployment: IDeployedFile[] = []) => {
      await method.prepare(gameDir, false, lastDeployment, normalize);
      await method.activate(modDir, modName, "", blacklist);
      return method.finalize(gameId, gameDir, stagingDir);
    },
    inGame: (relPath: string) => path.join(gameDir, relPath),
    deployedFiles: () =>
      relPaths.filter(
        (rel) =>
          nodeFs.statSync(path.join(gameDir, rel), { throwIfNoEntry: false })?.isFile() === true,
      ),
    manifest: (time = 1) =>
      relPaths.map((relPath) => ({ relPath, source: modName, target: "", time })),
    normalize,
    setBusyDialogAnswer: (answer) => {
      busyAnswer = answer;
    },
    blockUnlink: (relPath: string) => {
      const target = path.join(gameDir, relPath);
      nodeFs.unlinkSync(target);
      nodeFs.mkdirSync(target);
      nodeFs.writeFileSync(path.join(target, "occupied"), "");
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
