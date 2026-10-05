const Promise = require("bluebird");
const path = require("path");
const { fs, log, selectors, util } = require("@nexusmods/vortex-api");

const WINDOWS_EXEC = "KSP_x64.exe";
const LINUX_EXEC = "KSP.x86_64";

function gameExecutable(discoveryPath) {
  if (process.platform === "win32") {
    return WINDOWS_EXEC;
  }
  // the Windows build can be installed too, to run through Proton
  try {
    fs.statSync(path.join(discoveryPath, WINDOWS_EXEC));
    return WINDOWS_EXEC;
  } catch {
    return LINUX_EXEC;
  }
}

function findGame() {
  return util.GameStoreHelper.findByAppId("220200", "steam").then((game) => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: "kerbalspaceprogram",
    name: "Kerbal Space Program",
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => "GameData",
    logo: "gameart.jpg",
    executable: gameExecutable,
    requiredFiles: [path.join("GameData", "Squad")],
    environment: {
      SteamAPPId: "220200",
    },
    details: {
      steamAppId: 220200,
      hashFiles: ["KSP_x64_Data/Managed/Assembly-CSharp.dll"],
    },
  });

  return true;
}

module.exports = {
  default: main,
};
