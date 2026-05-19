import path from "node:path";

import { fs, util } from "vortex-api";
import type { types } from "vortex-api";

import { healthChecks } from "./diagnostic";
import {
  WOTR_GAME_ID,
  WOTR_INSTALLER_SPECS,
  installUmmMod,
  installUmmTool,
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
    name: "Pathfinder: Wrath\tof the Righteous",
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

  context.registerInstaller("wotr-umm-tool", 20, testUmmTool, installUmmTool);
  context.registerInstaller("wotr-umm-mod", 30, testUmmMod, installUmmMod);
  util.declareInstallers(context, WOTR_GAME_ID, WOTR_INSTALLER_SPECS);

  for (const check of healthChecks) {
    context.registerHealthCheck(check);
  }

  return true;
}

export default main;
