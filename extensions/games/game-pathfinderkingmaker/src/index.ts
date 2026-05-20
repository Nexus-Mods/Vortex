import path from "path";

import { registerDefaultModInstaller, registerUmmSupport } from "@vortex/game-extension-helpers";
import { actions, fs, util } from "vortex-api";
import type { types } from "vortex-api";

import { healthChecks } from "./diagnostic";
import {
  MOD_TYPES,
  getPortraitPath,
  getSavePath,
  installPortrait,
  installSave,
  testPortrait,
  testSave,
} from "./installers";

const NEXUS_ID = "pathfinderkingmaker";
const NAME = "Pathfinder:\tKingmaker";
const EXE_NAME = "Kingmaker";
const STEAM_ID = "640820";
const UMM_DLL = "UnityModManager.dll";
const GAME_IDS = new Set([NEXUS_ID]);

function readRegistryKey(hive: string, key: string, name: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winapi = require("winapi-bindings") as {
      RegGetValue: (hive: string, key: string, name: string) => { value: string } | undefined;
    };
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error("empty registry key");
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(new util.ProcessCanceled(String(err)));
  }
}

function findUnityModManager(): Promise<unknown> {
  return readRegistryKey("HKEY_CURRENT_USER", "Software\\UnityModManager", "Path").then((value) =>
    fs.statAsync(path.join(value, UMM_DLL)),
  );
}

async function setup(
  context: types.IExtensionContext,
  discovery: types.IDiscoveryResult,
): Promise<void> {
  await fs.ensureDirWritableAsync(path.join(discovery.path!, "Mods"));
  try {
    await findUnityModManager();
  } catch {
    return new Promise<void>((_resolve, reject) => {
      context.api.store!.dispatch(
        actions.showDialog(
          "question",
          "Action required",
          {
            message: "You must install Unity Mod Manager to use mods with " + NAME + ".",
          },
          [
            { label: "Cancel", action: () => reject(new util.UserCanceled()) },
            {
              label: "Go to the Unity Mod Manager page",
              action: () => {
                util.opn("https://www.nexusmods.com/site/mods/21/").catch(() => undefined);
                reject(new util.UserCanceled());
              },
            },
          ],
        ),
      );
    });
  }
}

function getDiscoveryPath(api: types.IExtensionApi, gameId: string): string | undefined {
  const state = api.store!.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  ) as types.IDiscoveryResult | undefined;
  return discovery?.path;
}

function main(context: types.IExtensionContext): boolean {
  context.registerGame({
    id: NEXUS_ID,
    name: NAME,
    logo: "gameart.webp",
    queryArgs: { steam: STEAM_ID },
    queryModPath: () => "Mods",
    executable: () => EXE_NAME + ".exe",
    requiredFiles: [EXE_NAME + ".exe"],
    // Native Promise is runtime-compatible with PromiseBB (.then/.catch).
    // Cast avoids pulling Bluebird into the module graph at import time.
    setup: ((discovery: types.IDiscoveryResult) =>
      setup(context, discovery)) as unknown as types.IGame["setup"],
  });

  // UMM tool installer (priority 15) + UMM mod type
  registerUmmSupport(context, GAME_IDS, {
    getDiscoveryPath: (gameId) => getDiscoveryPath(context.api, gameId),
  });

  // Portrait installer (priority 25) + portrait mod type
  context.registerInstaller(
    MOD_TYPES.portrait,
    25,
    (files: string[], gameId: string) => testPortrait(files, gameId, GAME_IDS),
    installPortrait,
  );
  context.registerModType(
    MOD_TYPES.portrait,
    25,
    (gameId) => GAME_IDS.has(gameId),
    () => getPortraitPath(util.getVortexPath),
    (() => Promise.resolve(false)) as never,
    { name: "Portrait", mergeMods: true },
  );

  // Save game installer (priority 30) + save mod type
  context.registerInstaller(
    MOD_TYPES.save,
    30,
    (files: string[], gameId: string) => testSave(files, gameId, GAME_IDS),
    installSave,
  );
  context.registerModType(
    MOD_TYPES.save,
    30,
    (gameId) => GAME_IDS.has(gameId),
    () => getSavePath(util.getVortexPath),
    (() => Promise.resolve(false)) as never,
    { name: "Save Game", mergeMods: true },
  );

  // Default copy-all installer (priority 200) for regular UMM mods
  registerDefaultModInstaller(context, NEXUS_ID + "-default", GAME_IDS);

  for (const check of healthChecks) {
    (context as unknown as { registerHealthCheck: (c: unknown) => void }).registerHealthCheck(
      check,
    );
  }

  return true;
}

export default main;
