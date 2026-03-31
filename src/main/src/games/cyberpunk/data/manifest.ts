import type { InternalGameManifest } from "@vortex/shared/ipc";

export const GAME_ID = "cyberpunk2077";

export const STEAM_APP_ID = "1091500";
export const GOG_APP_ID = "1423049311";
export const EPIC_APP_ID = "Ginger";

export const V2077_DIR = "V2077";
export const GAME_EXE_RELATIVE_PATH = "bin\\x64\\Cyberpunk2077.exe";
export const RED_LAUNCHER_RELATIVE_PATH = "REDprelauncher.exe";
export const RED_DEPLOY_RELATIVE_PATH = "tools\\redmod\\bin\\redMod.exe";
export const REDMOD_METADATA_RELATIVE_PATH = "tools\\redmod\\metadata.json";
export const REDMOD_MODS_DIR = "mods";
export const REDMOD_GENERATED_DIR = "r6\\cache\\modded";
export const LOAD_ORDER_DIR = `${V2077_DIR}\\Load Order`;
export const MODLIST_RELATIVE_PATH = `${V2077_DIR}\\modlist.txt`;

export const CYBERPUNK_MANIFEST: InternalGameManifest = {
  id: GAME_ID,
  name: "Cyberpunk 2077",
  mergeMods: true,
  queryModPath: "",
  executable: GAME_EXE_RELATIVE_PATH,
  parameters: ["-modded"],
  requiredFiles: [GAME_EXE_RELATIVE_PATH],
  logo: "gameart.png",
  environment: {
    SteamAPPId: STEAM_APP_ID,
  },
  details: {
    steamAppId: STEAM_APP_ID,
    gogAppId: GOG_APP_ID,
    epicAppId: EPIC_APP_ID,
  },
  compatible: {
    symlinks: false,
  },
  supportedTools: [
    {
      id: "cyberpunk2077-game-modded",
      name: "Launch Game with REDmods Enabled",
      shortName: "cp2077.exe -modded",
      executable: GAME_EXE_RELATIVE_PATH,
      requiredFiles: [GAME_EXE_RELATIVE_PATH],
      parameters: ["-modded"],
      relative: true,
      logo: "gameicon.jpg",
    },
    {
      id: "cyberpunk2077-redlauncher",
      name: "REDLauncher",
      shortName: "REDLauncher",
      executable: RED_LAUNCHER_RELATIVE_PATH,
      requiredFiles: [RED_LAUNCHER_RELATIVE_PATH],
      parameters: ["-modded"],
      relative: true,
      logo: "REDLauncher.png",
    },
    {
      id: "cyberpunk2077-reddeploy",
      name: "REDmod Deploy Latest Load Order",
      shortName: "REDdeploy",
      executable: RED_DEPLOY_RELATIVE_PATH,
      requiredFiles: [RED_DEPLOY_RELATIVE_PATH],
      parameters: [],
      relative: true,
      shell: true,
      exclusive: true,
      logo: "REDdeploy.png",
    },
  ],
};

export const CYBERPUNK_USAGE_INSTRUCTIONS = [
  "Only REDmods and autoconverted heritage archive mods are orderable.",
  "Archive mods that are not autoconverted still load alphabetically before all REDmods.",
  "Reinstall an archive mod with autoconvert enabled if you need it in the REDmod load order.",
].join(" ");
