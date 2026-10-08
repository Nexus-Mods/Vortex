import * as path from "node:path";

import { expect, vi } from "vitest";

import { test } from "../../test-utils/deploymentTest";
import type { IGame } from "../../types/IGame";
import * as fs from "../../util/fs";
import type { IDeployment } from "./LinkingDeployment";
import type { IDeployedFile, IDeploymentMethod } from "./types/IDeploymentMethod";
import BlacklistSet from "./util/BlacklistSet";

/** The private members of LinkingActivator this exercises directly. */
interface ILinkingInternals {
  context: { previousDeployment: IDeployment };
  unlinkChanged: (
    keys: string[],
    installationPath: string,
    dataPath: string,
    onError: (file: IDeployedFile | undefined, err: unknown) => void,
  ) => Promise<string[]>;
}

const internals = (method: IDeploymentMethod): ILinkingInternals =>
  method as unknown as ILinkingInternals;

const FILES = {
  "CrashLogger.ini": "[Debug]",
  "BugFixesSSE.log": "log line",
  "po3_Tweaks.ini": "[General]",
  "ActorLimitFix.log": "log line",
  "SkyUI_SE.esp": "esp data",
};

test("keeps every file whose unlink succeeded in the re-link list", async ({ makeDeployment }) => {
  const h = makeDeployment({ files: FILES });
  await h.method.prepare(h.gameDir, false, h.manifest(), h.normalize);

  const activator = internals(h.method);
  const keys: string[] = Object.keys(activator.context.previousDeployment);

  // removeDeployedFile rejects for a key with no previous deployment; the rest unlink
  // nothing, which counts as success
  const failing = [keys[1], keys[3]];
  for (const key of failing) {
    delete activator.context.previousDeployment[key];
  }

  const relink = await activator.unlinkChanged(
    keys.slice(),
    h.stagingDir,
    h.gameDir,
    () => undefined,
  );

  expect(relink).toEqual(keys.filter((key) => !failing.includes(key)));
});

test("links to the staged file without a doubled separator when the staging path ends in one", async ({
  makeDeployment,
}) => {
  const modName = "SomeMod";
  const h = makeDeployment({ files: { "mod.ini": "[General]" }, method: "symlink", modName });
  const symlink = vi.spyOn(fs, "symlinkAsync").mockResolvedValue(undefined);

  try {
    await h.method.prepare(h.gameDir, false, [], h.normalize);
    await h.method.activate(
      path.join(h.stagingDir, modName),
      modName,
      "",
      new BlacklistSet([], { details: {} } as IGame, h.normalize),
    );
    await h.method.finalize("skyrimse", h.gameDir, h.stagingDir + path.sep);

    expect(symlink).toHaveBeenCalledTimes(1);
    expect(symlink.mock.calls[0][0]).toBe(path.join(h.stagingDir, modName, "mod.ini"));
  } finally {
    symlink.mockRestore();
  }
});
