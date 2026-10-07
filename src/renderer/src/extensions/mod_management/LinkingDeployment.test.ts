import { expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";
import type { IDeployment } from "./LinkingDeployment";
import type { IDeployedFile, IDeploymentMethod } from "./types/IDeploymentMethod";

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
