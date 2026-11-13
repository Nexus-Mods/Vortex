const path = require("path");
const { fs, util } = require("@nexusmods/vortex-api");

const GAME_ID = "shadowrunreturns";

function findGame() {
  return util.GameStoreHelper.findByName("Shadowrun Returns", "steam").then(
    (game) => game.gamePath,
  );
}

function modPath() {
  return path.join("Shadowrun_Data", "StreamingAssets", "ContentPacks");
}

function prepareForModding(discovery) {
  return fs
    .ensureDirWritableAsync(path.join(discovery.path, modPath()), () => Promise.resolve())
    .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, "BepInEx", "plugins")));
}
const supportedTools = [
  {
    id: "shadowruneditor",
    name: "Editor",
    logo: "auto",
    executable: () => "ShadowrunEditor.exe",
    requiredFiles: ["ShadowrunEditor.exe"],
    relative: true,
  },
];

function main(context) {
  context.requireExtension("modtype-bepinex");

  context.registerGame({
    id: GAME_ID,
    name: "Shadowrun Returns",
    mergeMods: false,
    queryPath: findGame,
    supportedTools,
    setup: prepareForModding,
    queryModPath: modPath,
    logo: "gameart.jpg",
    executable: () => "Shadowrun.exe",
    requiredFiles: ["Shadowrun.exe"],
    environment: {
      SteamAPPId: "234650",
    },
    details: {
      steamAppId: 234650,
      hashFiles: [
        "Shadowrun_Data/Managed/Assembly-UnityScript.dll",
        "Shadowrun_Data/Managed/Assembly-CSharp.dll",
        "Shadowrun_Data/Managed/Assembly-CSharp-firstpass.dll",
        "ShadowrunEditor.exe",
      ],
    },
  });

  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        // The game's BepInEx mods bundle their own loader, so don't install
        // a second copy automatically.
        autoDownloadBepInEx: false,
        architecture: "x86",
        unityBuild: "unitymono",
        doorstopConfig: { doorstopType: "default" },
        // Shadowrun Returns runs Unity 4.2, where BepInEx's default
        // Application entrypoint crashes during startup.
        bepinexConfigObject: {
          Preloader: {
            Entrypoint: {
              Type: "Camera",
              Method: ".cctor",
            },
          },
        },
      });
    }
  });

  return true;
}

module.exports = {
  default: main,
};
