const Promise = require("bluebird");
const path = require("path");
<<<<<<< HEAD
const { util } = require("@nexusmods/vortex-api");
=======
const { fs, util } = require("vortex-api");
>>>>>>> fd54aa379 (Merge pull request #23417 from Nexus-Mods/fix/app-495)
const winapi = require("winapi-bindings");

const BODYSLIDE_DIR = path.join("Data", "CalienteTools", "BodySlide");
const BODYSLIDE_X64 = path.join(BODYSLIDE_DIR, "BodySlide x64.exe");
const BODYSLIDE_EXE = path.join(BODYSLIDE_DIR, "BodySlide.exe");

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      "HKEY_LOCAL_MACHINE",
      "Software\\Wow6432Node\\Bethesda Softworks\\skyrim",
      "Installed Path",
    );
    if (!instPath) {
      throw new Error("empty registry key");
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName("The Elder Scrolls V: Skyrim").then((game) => game.gamePath);
  }
}

let tools = [
  {
    id: "TES5Edit",
    name: "TES5Edit",
    logo: "tes5edit.png",
    executable: () => "TES5Edit.exe",
    requiredFiles: ["TES5Edit.exe"],
  },
  {
    id: "WryeBash",
    name: "Wrye Bash",
    logo: "wrye.png",
    executable: () => "Wrye Bash.exe",
    requiredFiles: ["Wrye Bash.exe"],
  },
  {
    id: "FNIS",
    name: "Fores New Idles in Skyrim",
    shortName: "FNIS",
    logo: "fnis.png",
    executable: () => "GenerateFNISForUsers.exe",
    requiredFiles: ["GenerateFNISForUsers.exe"],
    relative: true,
  },
  {
    id: "skse",
    name: "Skyrim Script Extender",
    shortName: "SKSE",
    executable: () => "skse_loader.exe",
    requiredFiles: ["skse_loader.exe", "TESV.exe"],
    relative: true,
    exclusive: true,
    defaultPrimary: true,
  },
  {
    id: "bodyslide",
    name: "BodySlide",
    executable: (discoveryPath) => {
      if (discoveryPath !== undefined) {
        try {
          fs.statSync(path.join(discoveryPath, BODYSLIDE_X64));
          return BODYSLIDE_X64;
        } catch (err) {
          return BODYSLIDE_EXE;
        }
      }
      return BODYSLIDE_EXE;
    },
    requiredFiles: [BODYSLIDE_EXE],
    relative: true,
    logo: "auto",
  },
];

function main(context) {
  context.registerGame({
    id: "skyrim",
    name: "Skyrim",
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => "Data",
    logo: "gameart.jpg",
    executable: () => "TESV.exe",
    requiredFiles: ["TESV.exe"],
    environment: {
      SteamAPPId: "72850",
    },
    details: {
      steamAppId: 72850,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
