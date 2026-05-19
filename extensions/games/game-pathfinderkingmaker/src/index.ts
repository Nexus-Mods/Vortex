import path from "path";

import { registerDefaultModInstaller, registerUmmSupport } from "@vortex/game-extension-helpers";
import { actions, fs, util } from "vortex-api";
import type { types } from "vortex-api";

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

  registerUmmSupport(context, GAME_IDS, {
    getDiscoveryPath: (gameId) => getDiscoveryPath(context.api, gameId),
  });

  registerDefaultModInstaller(context, NEXUS_ID + "-default", GAME_IDS);

  return true;
}

export default main;
