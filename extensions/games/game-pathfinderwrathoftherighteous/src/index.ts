import path from "node:path";

import { fs, selectors, util } from "vortex-api";
import type { types } from "vortex-api";

import { healthChecks } from "./diagnostic";
import {
  WOTR_GAME_ID,
  WOTR_INSTALLER_SPECS,
  WOTR_MOD_TYPES,
  getOwlcatModPath,
  getPortraitPath,
  installOwlcatMod,
  installPortrait,
  installUmmMod,
  installUmmTool,
  testOwlcatMod,
  testPortrait,
  testUmmMod,
  testUmmTool,
} from "./installers";

async function setup(discovery: types.IDiscoveryResult): Promise<void> {
  await fs.ensureDirWritableAsync(path.join(discovery.path!, "Mods"));
}

async function resolveGameVersion(discoveryPath: string): Promise<string> {
  const versionFilepath = path.join(discoveryPath, "Wrath_Data", "StreamingAssets", "Version.info");
  const data: string = await fs.readFileAsync(versionFilepath, { encoding: "utf8" });
  const segments = data.split(" ");
  const version = segments[3];
  if (version == null) {
    throw new util.DataInvalid("Failed to resolve version");
  }
  return version;
}

function main(context: types.IExtensionContext): boolean {
  context.registerGame({
    id: WOTR_GAME_ID,
    name: "Pathfinder: Wrath of the Righteous",
    queryArgs: {
      steam: "1184370",
      gog: "1207187357",
    },
    queryModPath: () => "Mods",
    logo: "gameart.webp",
    executable: () => "Wrath.exe",
    getGameVersion: resolveGameVersion,
    requiredFiles: ["Wrath.exe"],
    setup,
  });

  context.registerModType(
    WOTR_MOD_TYPES.ummTool,
    25,
    (gameId) => gameId === WOTR_GAME_ID,
    () => {
      const state = context.api.getState();
      const discovery = selectors.discoveryByGame(state, WOTR_GAME_ID);
      return discovery?.path ?? "";
    },
    () => Promise.resolve(false),
    { mergeMods: true, name: "UMM Tool" },
  );

  context.registerModType(
    WOTR_MOD_TYPES.portrait,
    25,
    (gameId) => gameId === WOTR_GAME_ID,
    getPortraitPath,
    () => Promise.resolve(false),
    { mergeMods: true, name: "Portrait" },
  );

  context.registerModType(
    WOTR_MOD_TYPES.owlcatMod,
    25,
    (gameId) => gameId === WOTR_GAME_ID,
    getOwlcatModPath,
    () => Promise.resolve(false),
    { mergeMods: true, name: "Owlcat Modification" },
  );

  context.registerInstaller("wotr-umm-tool", 20, testUmmTool, installUmmTool);
  context.registerInstaller("wotr-umm-mod", 30, testUmmMod, installUmmMod);
  context.registerInstaller("wotr-portrait", 40, testPortrait, installPortrait);
  context.registerInstaller("wotr-owlcat-mod", 50, testOwlcatMod, installOwlcatMod);
  util.declareInstallers(context, WOTR_GAME_ID, WOTR_INSTALLER_SPECS);

  for (const check of healthChecks) {
    context.registerHealthCheck(check);
  }

  return true;
}

export default main;
