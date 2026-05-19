import path from "node:path";

import { fs, util } from "vortex-api";
import type { types } from "vortex-api";

const GAME_ID = "pathfinderwrathoftherighteous";

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
  context.requireExtension("modtype-umm");
  context.registerGame({
    id: GAME_ID,
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
  context.once(() => {
    if (context.api.ext.ummAddGame !== undefined) {
      context.api.ext.ummAddGame({
        gameId: GAME_ID,
        autoDownloadUMM: true,
      });
    }
  });

  return true;
}

export default main;
