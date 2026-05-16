const Promise = require("bluebird");
const path = require("path");
const { getFileVersion } = require("exe-version");
const { util } = require("vortex-api");
const winapi = require("winapi-bindings");

const GAME_ID = "fallout4vr";
const ESL_ENABLER_LIB = "Daytripper4.dll";
const ESL_NOTIF_ID = "fallout4vr-esl-enabler-notif";

/*
Ignore the Meshes\AnimTextData\AnimationOffsets\PersistantSubgraphInfoAndOffsetData.txt file as a conflict. 
It's present in a lot of weapon mods but doesn't matter if it's overwritten. 
This issue is compounded by users extracting all their BA2s. 
*/
const IGNORED_FILES = [path.join("**", "PersistantSubgraphInfoAndOffsetData.txt")];

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      "HKEY_LOCAL_MACHINE",
      "Software\\Wow6432Node\\Bethesda Softworks\\Fallout 4 VR",
      "Installed Path",
    );
    if (!instPath) {
      throw new Error("empty registry key");
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName("Fallout 4 VR").then((game) => game.gamePath);
  }
}

function getGameVersion(gamePath, exePath) {
  const fullPath = path.join(gamePath, exePath);
  const fileVersion = getFileVersion(fullPath);

  return fileVersion + "-VR";
}

const tools = [
  {
    id: "FO4VREdit",
    name: "FO4VREdit",
    logo: "fo3edit.png",
    executable: () => "FO4VREdit.exe",
    requiredFiles: ["FO4VREdit.exe"],
  },
  {
    id: "F4SEVR",
    name: "F4SE VR",
    executable: () => "f4sevr_loader.exe",
    requiredFiles: ["f4sevr_loader.exe"],
    defaultPrimary: true,
  },
];

function isESLSupported(api) {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.store === "xbox") {
    return false;
  }
  const modState = util.getSafe(state, ["persistent", "profiles", profileId, "modState"], {});
  const isEnabled = (modId) => util.getSafe(modState, [modId, "enabled"], false);
  const mods = util.getSafe(state, ["persistent", "mods", GAME_ID], {});
  const hasESLEnabler = Object.keys(mods).some(
    (modId) => isEnabled(modId) && mods[modId]?.attributes?.eslEnabler === true,
  );
  if (hasESLEnabler) {
    api.dismissNotification(ESL_NOTIF_ID);
  }
  return hasESLEnabler;
}

function testEslEnabler(files, gameId) {
  const isFallout4VR = gameId === GAME_ID;
  const isESLEnabler = files.some((file) => file.toLowerCase().endsWith(ESL_ENABLER_LIB));
  return Promise.resolve({
    supported: isFallout4VR && isESLEnabler,
    requiredFiles: [],
  });
}

function installEslEnabler(files, destinationPath) {
  const filtered = files.filter((file) => path.extname(file) !== "");
  const instructions = filtered.map((file) => {
    const segments = file.split(path.sep);
    segments.splice(0, 1, "Data");
    return {
      type: "copy",
      source: file,
      destination: segments.join(path.sep),
    };
  });

  // Remove this once the mod type conflict issue is resolved
  instructions.push({ type: "setmodtype", value: "dinput" });
  instructions.push({ type: "attribute", key: "eslEnabler", value: true });

  return Promise.resolve({ instructions });
}

function prepare(api, discovery) {
  if (isESLSupported(api)) {
    return Promise.resolve();
  }

  api.sendNotification({
    id: ESL_NOTIF_ID,
    type: "info",
    title: "ESL Support",
    message:
      "Fallout 4 VR requires a mod to enable ESL support. Mod must be installed through Vortex for ESL support to work.",
    actions: [
      {
        title: "Download",
        action: () =>
          util.opn("https://www.nexusmods.com/fallout4/mods/91141?tab=files").catch(() => {}),
      },
    ],
  });
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: "Fallout 4 VR",
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => "Data",
    logo: "gameart.jpg",
    executable: () => "Fallout4VR.exe",
    getGameVersion,
    setup: (discovery) => prepare(context.api, discovery),
    requiredFiles: ["Fallout4VR.exe"],
    environment: {
      SteamAPPId: "611660",
    },
    details: {
      steamAppId: 611660,
      compatibleDownloads: ["fallout4"],
      supportsESL: () => isESLSupported(context.api),
      ignoreConflicts: IGNORED_FILES,
      nexusPageId: "fallout4",
    },
  });

  context.registerInstaller("fallout4vr-esl-enabler", 10, testEslEnabler, installEslEnabler);
  return true;
}

module.exports = {
  default: main,
};
