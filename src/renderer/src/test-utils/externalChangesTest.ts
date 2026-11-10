import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { type VortexModId, VortexProfileId, VortexStagingFolder } from "@vortex/shared";

import { confirmExternalChanges } from "../extensions/mod_management/actions/session";
import { sessionReducer } from "../extensions/mod_management/reducers/session";
import type {
  IDeployedFile,
  IFileChange,
} from "../extensions/mod_management/types/IDeploymentMethod";
import type { IFileEntry } from "../extensions/mod_management/types/IFileEntry";
import type { IMod } from "../extensions/mod_management/types/IMod";
import { deployedFilePath } from "../extensions/mod_management/util/deployedFilePath";
import { dealWithExternalChanges } from "../extensions/mod_management/util/externalChanges";
import type { IDeploymentMethod } from "../types/IExtensionContext";
import { makeGameHarness, type IHarnessReducerBinding } from "./builders";
import type { IApiHarness, IGameHarness } from "./harnessTypes";
import { test as installManagerTest } from "./installManagerTest";
import { makeTempDir, writeInto } from "./tempDir";

export interface IExternalChangesHarness extends IGameHarness {
  // the default mod type's deploy target
  gameDir: string;
  // each dialog's entries, in order, confirmed as preselected
  dialogs: IFileEntry[][];
  stageFile: (modFolder: string, relPath: string) => Promise<void>;
  // the mod's subfolder, for games that don't merge mods (mergeMods off)
  deployFile: (relPath: string, target?: string) => Promise<void>;
  // runs against the default mod type's last deployment (empty unless given)
  dealWithExternalChanges: (
    recentChanges: Set<string> | undefined,
    lastDeployment?: IDeployedFile[],
  ) => Promise<IDeployedFile[][]>;
}

export interface IExternalChangesFixtures {
  makeExternalChanges: (
    changes: IFileChange[],
    // the game's installed mods
    mods?: Record<VortexModId, IMod>,
  ) => Promise<IExternalChangesHarness>;
}

// the slice the external-changes dialog reads
export const EXTERNAL_CHANGES_BINDINGS: IHarnessReducerBinding[] = [
  { path: ["session", "mods"], reducer: sessionReducer },
];

/** Confirms every external-changes dialog with what it preselects; returns each dialog's entries. */
export function confirmExternalChangesDialogs(harness: IApiHarness): IFileEntry[][] {
  const dialogs: IFileEntry[][] = [];
  harness.api.onStateChange(["session", "mods", "changes"], (_previous, current) => {
    const entries = current as IFileEntry[];
    if (entries.length > 0) {
      dialogs.push(entries);
      harness.api.store.dispatch(confirmExternalChanges(entries, false));
    }
  });
  return dialogs;
}

async function makeExternalChangesHarness(
  changes: IFileChange[],
  mods: Record<VortexModId, IMod> = {},
): Promise<IExternalChangesHarness> {
  const root = await makeTempDir("vortex-external-changes-");
  const stagingDir = path.join(root, "staging");
  const gameDir = path.join(root, "game", "Data");
  await mkdir(stagingDir, { recursive: true });
  await mkdir(gameDir, { recursive: true });

  const harness = makeGameHarness(
    { installPath: { skyrimse: stagingDir }, mods },
    EXTERNAL_CHANGES_BINDINGS,
  );
  const dialogs = confirmExternalChangesDialogs(harness);

  const activator = {
    externalChanges: () => Promise.resolve(changes),
  } as unknown as IDeploymentMethod;

  return {
    ...harness,
    gameDir,
    dialogs,
    stageFile: (modFolder, relPath) => writeInto(path.join(stagingDir, modFolder), relPath),
    deployFile: (relPath, target) => writeInto(deployedFilePath(gameDir, target, ""), relPath),
    dealWithExternalChanges: (recentChanges, lastDeployment = []) =>
      dealWithExternalChanges(
        harness.api,
        activator,
        VortexProfileId(harness.profileId),
        VortexStagingFolder(stagingDir),
        { "": gameDir },
        { "": lastDeployment },
        recentChanges,
      ),
  };
}

/**
 * External-changes suites: real staging and game folders, an activator reporting the given
 * changes, and a dialog confirming what it preselects. Includes makeInstallManager.
 */
export const test = installManagerTest.extend<IExternalChangesFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement
  makeExternalChanges: async ({ task: _task }, use) => {
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use(makeExternalChangesHarness);
  },
});
