import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { TFunction } from "i18next";
import { expect } from "vitest";

import { registerHarnessGame } from "../../test-utils/builders";
import { test } from "../../test-utils/harnessTest";
import type { IDeploymentMethod } from "../mod_management/types/IDeploymentMethod";
import type { IExtensionContextEx } from "./index";
import init from "./index";

/** Returns the english text with its placeholders filled in, as the real translation does. */
const t = ((text: string, options?: { replace?: Record<string, string> }) =>
  text.replace(/{{(\w+)}}/g, (_match, key: string) => options?.replace?.[key] ?? "")) as TFunction;

const GAME_ID = "somegame";

test("a missing output directory is named in the reason", ({ makeApi, onTestFinished }) => {
  const gamePath = nodeFs.mkdtempSync(path.join(os.tmpdir(), "vortex-symlink-"));
  onTestFinished(() => nodeFs.rmSync(gamePath, { recursive: true, force: true }));
  registerHarnessGame(GAME_ID);
  const { api } = makeApi({ discovered: { [GAME_ID]: { path: gamePath } } });
  let method: IDeploymentMethod;
  init({
    api,
    registerDeploymentMethod: (registered: IDeploymentMethod) => {
      method = registered;
    },
  } as unknown as IExtensionContextEx);

  // the harness game deploys into "mods" below the game folder, which was never created
  const reason = method.isSupported(api.getState(), GAME_ID, "");

  expect(reason?.description(t)).toBe(
    `Output directory "${path.join(gamePath, "mods")}" doesn't exist.`,
  );
});
