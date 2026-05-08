import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("@electron/remote") as typeof import("electron");
import { fs, log, util } from "vortex-api";
import type { types } from "vortex-api";

const XCOM2_ID = "xcom2";
const WOTC_ID = "xcom2-wotc";
const XCOM2_MODS = path.join("XComGame", "Mods");
const XCOM2_CONFIG = path.join("XComGame", "Config");
const WOTC_MODS = path.join("XCom2-WarOfTheChosen", "XComGame", "Mods");
const WOTC_CONFIG = path.join("XCom2-WarOfTheChosen", "XComGame", "Config");
const MOD_EXT = ".XComMod";
const MOD_OPTIONS = "DefaultModOptions.ini";

const STEAM_ID = "268500";
const GOG_ID = "1482002159";
const EPIC_ID = "3be3c4d681bc46b3b8b26c5df3ae0a18";

const X2_DEVTOOLS_STEAM_ID = "299990";
const WOTC_DEVTOOLS_STEAM_ID = "602410";

function optionsPath(gameId: string): string {
  switch (gameId) {
    case XCOM2_ID:
      return XCOM2_CONFIG;
    case WOTC_ID:
      return WOTC_CONFIG;
    default:
      return "";
  }
}

function getModsPath(gameId: string): string {
  switch (gameId) {
    case XCOM2_ID:
      return XCOM2_MODS;
    case WOTC_ID:
      return WOTC_MODS;
    default:
      return "";
  }
}

function usageInstructions(gameId: string): string {
  return (
    `This page shows a list of all XCOM 2 mods you have installed with Vortex, Steam Workshop or manually.<br/><br/>` +
    `Use the checkboxes on this page to enable or disable the mods. Enabled mods will be added to ${MOD_OPTIONS} in the ${optionsPath(gameId)} folder and will be loaded by the game.`
  );
}

function findDevTools(game: string) {
  const steamId = game === XCOM2_ID ? X2_DEVTOOLS_STEAM_ID : WOTC_DEVTOOLS_STEAM_ID;
  return util.GameStoreHelper.findByAppId([steamId]).then((entry) => entry.gamePath);
}

function prepareForModding(discovery: types.IDiscoveryResult, modPath: string) {
  return fs.ensureDirWritableAsync(path.join(discovery.path!, modPath));
}

function supportedTools(game: string): types.ITool[] {
  return [
    {
      id: `${game}-launcher`,
      name: "Launcher",
      logo: path.join("icons", game === XCOM2_ID ? "xcom-icon.png" : "wotc-icon.png"),
      executable: () => path.join("Launcher", "launcher.exe"),
      requiredFiles: [path.join("Launcher", "launcher.exe")],
      relative: true,
    },
    {
      id: `${game}-devtools`,
      name: "ModBuddy",
      logo: path.join("icons", "modbuddy.png"),
      queryPath: () => findDevTools(game),
      executable: () => path.join("Binaries", "Win32", "ModBuddy", "XCOM ModBuddy.exe"),
      requiredFiles: [path.join("Binaries", "Win32", "ModBuddy", "XCOM ModBuddy.exe")],
    },
  ];
}

// Installer

function testMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const supported =
    (gameId === XCOM2_ID || gameId === WOTC_ID) &&
    !!files.find((file) => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase());

  return Promise.resolve({ supported, requiredFiles: [] });
}

async function installMod(files: string[]): Promise<types.IInstallResult> {
  const xComModFiles = files.filter(
    (file) => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase(),
  );

  const attributes: types.IInstruction[] = [
    {
      type: "attribute",
      key: "xComMods",
      value: xComModFiles.map((file) => path.basename(file, MOD_EXT)),
    },
  ];

  const copy: types.IInstruction[] = [];
  for (const mod of xComModFiles) {
    const modName = path.basename(mod, MOD_EXT);
    const modFolder = path.dirname(mod);
    const modFiles = files.filter(
      (file) => file.indexOf(modFolder) !== -1 && !file.endsWith(path.sep),
    );
    for (const file of modFiles) {
      const shortPath =
        modFolder !== "." ? file.substr(file.indexOf(modFolder) + modFolder.length) : file;
      copy.push({
        type: "copy",
        source: file,
        destination: path.join(modName, shortPath),
      });
    }
  }

  return { instructions: [...copy, ...attributes] };
}

// Load order

function validate(_prev: types.LoadOrder, cur: types.LoadOrder): Promise<types.IValidationResult> {
  const invalidNames = cur.filter((entry) => entry.name.indexOf('"') !== -1);
  const invalid = invalidNames.map((entry) => ({
    id: entry.id,
    reason: "contains invalid characters.",
  }));
  if (invalidNames.length) return Promise.resolve({ invalid });
  return Promise.resolve(undefined as unknown as types.IValidationResult);
}

async function deserializeLoadOrder(
  api: types.IExtensionApi,
  gameId: string,
): Promise<types.LoadOrder> {
  const state = api.store!.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  ) as types.IDiscoveryResult | undefined;
  if (!discovery?.path) {
    throw new util.ProcessCanceled("The game could not be discovered.");
  }

  const modsPath = path.join(discovery.path, getModsPath(gameId));
  const folders: string[] = [];
  try {
    const modFolders = await fs.readdirAsync(modsPath);
    for (const entry of modFolders) {
      try {
        const folderStat = await fs.statAsync(path.join(modsPath, entry));
        if (!folderStat.isDirectory()) continue;
        await fs.statAsync(path.join(modsPath, entry, `${entry}${MOD_EXT}`));
        folders.push(entry);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          log("warn", "Error checking for XComMod file in mod folder", err);
        }
      }
    }
  } catch (err) {
    log("error", `Error reading ${gameId} mods folder`, err);
  }

  let deployedFiles: { relPath: string; source: string }[] = [];
  try {
    const manifest = await util.getManifest(api, "", gameId);
    deployedFiles = manifest.files;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log("error", `Error reading manifest for ${gameId}`, err);
    }
  }

  let workshopMods: string[] = [];
  if (discovery.path.toLowerCase().includes("steamapps")) {
    const steamApps = discovery.path.substr(0, discovery.path.indexOf("common"));
    const workshopDir = path.join(steamApps, "workshop", "content", STEAM_ID);
    try {
      const entries = await fs.readdirAsync(workshopDir);
      const wsFolders = (entries as string[]).filter((f: string) => !path.extname(f));
      for (const cur of wsFolders) {
        const wsModPath = path.join(workshopDir, cur);
        let wsModDir: string[] = [];
        try {
          wsModDir = await fs.readdirAsync(wsModPath);
        } catch {
          continue;
        }
        const modFile = wsModDir.find(
          (file: string) => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase(),
        );
        if (modFile) workshopMods.push(path.basename(modFile, MOD_EXT));
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log("warn", `Error reading workshop mods for ${gameId}`, err);
      }
    }
  }

  const optionsIni = path.join(discovery.path, optionsPath(gameId), MOD_OPTIONS);
  let enabledMods: string[] = [];
  try {
    const file = await fs.readFileAsync(optionsIni, "utf8");
    const arr = (file as string).split("\n");
    const active = arr
      .filter((line: string) => line.startsWith("ActiveMods="))
      .map((m: string) => m.replace("ActiveMods=", ""));
    const names = active.map((mod: string) => mod.replace(/"/g, ""));
    enabledMods = names.filter(
      (name: string) => folders.includes(name) || workshopMods.includes(name),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      log("info", `${MOD_OPTIONS} does not exist for ${gameId}`);
    } else {
      log("error", `Error reading ${MOD_OPTIONS} for ${gameId}`, err);
    }
  }

  const loadOrderUniques = new Set([...enabledMods, ...folders, ...workshopMods]);

  return [...loadOrderUniques].map((xmod) => {
    const steamMod = workshopMods.includes(xmod);
    const enabled = enabledMods.includes(xmod);
    const xmodPath = path.join(xmod, `${xmod}${MOD_EXT}`);
    const deployed = deployedFiles.find(
      (file) => file.relPath.toLowerCase() === xmodPath.toLowerCase(),
    );
    return {
      id: steamMod ? `steam-${xmod}.toLowerCase()` : xmod.toLowerCase(),
      name: xmod,
      enabled,
      modId: deployed ? deployed.source : undefined,
    };
  });
}

async function serializeLoadOrder(
  api: types.IExtensionApi,
  loadOrder: types.LoadOrder,
  gameId: string,
): Promise<void> {
  const state = api.store!.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  ) as types.IDiscoveryResult | undefined;
  if (!discovery?.path) {
    throw new util.ProcessCanceled("The game could not be discovered.");
  }
  const optionsIni = path.join(discovery.path, optionsPath(gameId), MOD_OPTIONS);

  const mods = loadOrder.filter((entry) => entry.enabled).map((entry) => entry.name);
  await fs.writeFileAsync(optionsIni, xComModOptionsIni(mods), { encoding: "utf-8" });
}

function xComModOptionsIni(mods: string[]): string {
  return (
    `;Generated by Vortex ${app.getVersion()} (https://www.nexusmods.com/about/vortex/)\n` +
    "[Engine.XComModOptions]\n" +
    mods.map((mod) => `ActiveMods="${mod}"`).join("\n") +
    '\n\n;Use the below pattern to activate mods (no "+"/"-" etc. operators as this is the base INI file)\n' +
    ';ActiveMods="TerrorFromTheDerp"\n' +
    ';ActiveMods="Squadsize_EU"'
  );
}

// Main

function main(context: types.IExtensionContext): boolean {
  context.registerGame({
    id: XCOM2_ID,
    name: "XCOM 2",
    logo: "gameart-xcom2.webp",
    queryArgs: {
      steam: STEAM_ID,
      gog: GOG_ID,
      epic: EPIC_ID,
    },
    queryModPath: () => XCOM2_MODS,
    executable: () => path.join("Binaries", "Win64", "XCom2.exe"),
    setup: (discovery) => prepareForModding(discovery, XCOM2_MODS),
    requiredFiles: [
      "XComGame",
      path.join("XComGame", "CookedPCConsole", "3DUIBP.upk"),
      path.join("XComGame", "CharacterPool", "Importable", "Demos&Replays.bin"),
    ],
    supportedTools: supportedTools(XCOM2_ID),
    parameters: [
      "-fromLauncher",
      "-review",
      "-noRedScreens",
      "-noStartupMovies",
      "-CrashDumpWatcher",
    ],
    details: {
      gogAppId: GOG_ID,
    },
  });

  context.registerGame({
    id: WOTC_ID,
    name: "XCOM 2: War of the Chosen",
    logo: "gameart-wotc.webp",
    queryArgs: {
      steam: STEAM_ID,
      gog: GOG_ID,
      epic: EPIC_ID,
    },
    queryModPath: () => WOTC_MODS,
    executable: () => path.join("XCom2-WarOfTheChosen", "Binaries", "Win64", "XCom2.exe"),
    setup: (discovery) => prepareForModding(discovery, WOTC_MODS),
    requiredFiles: [
      "XCom2-WarOfTheChosen",
      path.join("XCom2-WarOfTheChosen", "XComGame", "CookedPCConsole", "3DUIBP.upk"),
    ],
    parameters: [
      "-fromLauncher",
      "-review",
      "-noRedScreens",
      "-noStartupMovies",
      "-CrashDumpWatcher",
    ],
    supportedTools: supportedTools(WOTC_ID),
    details: {
      gogAppId: GOG_ID,
      nexusPageId: "xcom2",
      compatibleDownloads: ["xcom2"],
    },
  });

  context.registerInstaller("xcom2-installer", 25, testMod, installMod);

  context.registerLoadOrder({
    gameId: XCOM2_ID,
    validate,
    deserializeLoadOrder: () => deserializeLoadOrder(context.api, XCOM2_ID),
    serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder, XCOM2_ID),
    toggleableEntries: true,
    usageInstructions: usageInstructions(XCOM2_ID),
  });

  context.registerLoadOrder({
    gameId: WOTC_ID,
    validate,
    deserializeLoadOrder: () => deserializeLoadOrder(context.api, WOTC_ID),
    serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder, WOTC_ID),
    toggleableEntries: true,
    usageInstructions: usageInstructions(WOTC_ID),
  });

  return true;
}

export default main;
