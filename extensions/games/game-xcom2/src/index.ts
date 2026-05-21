import path from "path";

import { fs, log, util } from "vortex-api";
import type { types } from "vortex-api";

import { healthChecks } from "./diagnostic";
import {
  XCOM2_CONFIG_DROP_IN_PRIORITY,
  XCOM2_GAME_IDS,
  XCOM2_INSTALLER_SPECS,
  XCOM2_MOD_TYPES,
  installConfigDropIn,
  testConfigDropIn,
} from "./installers";

let cachedVersion: string | undefined;
function getAppVersion(): string {
  if (cachedVersion === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedVersion = (require("@electron/remote") as typeof import("electron")).app.getVersion();
    } catch {
      cachedVersion = "unknown";
    }
  }
  return cachedVersion;
}

const MOD_EXT = ".XComMod";
const MOD_OPTIONS = "DefaultModOptions.ini";
const STEAM_ID = "268500";
const GOG_ID = "1482002159";
const EPIC_ID = "3be3c4d681bc46b3b8b26c5df3ae0a18";
const LAUNCH_PARAMS = [
  "-fromLauncher",
  "-review",
  "-noRedScreens",
  "-noStartupMovies",
  "-CrashDumpWatcher",
];
const QUERY_ARGS = { steam: STEAM_ID, gog: GOG_ID, epic: EPIC_ID };

interface GameDef {
  id: string;
  name: string;
  logo: string;
  baseDir: string;
  devToolsSteamId: string;
  launcherIcon: string;
  requiredFiles: string[];
  extraDetails?: Record<string, unknown>;
}

const GAMES: GameDef[] = [
  {
    id: "xcom2",
    name: "XCOM 2",
    logo: "gameart-xcom2.webp",
    baseDir: "",
    devToolsSteamId: "299990",
    launcherIcon: "xcom-icon.png",
    requiredFiles: [
      "XComGame",
      path.join("XComGame", "CookedPCConsole", "3DUIBP.upk"),
      path.join("XComGame", "CharacterPool", "Importable", "Demos&Replays.bin"),
    ],
  },
  {
    id: "xcom2-wotc",
    name: "XCOM 2: War of the Chosen",
    logo: "gameart-wotc.webp",
    baseDir: "XCom2-WarOfTheChosen",
    devToolsSteamId: "602410",
    launcherIcon: "wotc-icon.png",
    requiredFiles: [
      "XCom2-WarOfTheChosen",
      path.join("XCom2-WarOfTheChosen", "XComGame", "CookedPCConsole", "3DUIBP.upk"),
    ],
    extraDetails: { nexusPageId: "xcom2", compatibleDownloads: ["xcom2"] },
  },
];

const modsPath = (g: GameDef) => path.join(g.baseDir, "XComGame", "Mods");
const configPath = (g: GameDef) => path.join(g.baseDir, "XComGame", "Config");
const exePath = (g: GameDef) => path.join(g.baseDir, "Binaries", "Win64", "XCom2.exe");

function discoverPath(api: types.IExtensionApi, gameId: string): string {
  const state = api.store!.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  ) as types.IDiscoveryResult | undefined;
  if (!discovery?.path) {
    throw new util.ProcessCanceled("The game could not be discovered.");
  }
  return discovery.path;
}

function supportedTools(g: GameDef): types.ITool[] {
  return [
    {
      id: `${g.id}-launcher`,
      name: "Launcher",
      logo: path.join("icons", g.launcherIcon),
      executable: () => path.join("Launcher", "launcher.exe"),
      requiredFiles: [path.join("Launcher", "launcher.exe")],
      relative: true,
    },
    {
      id: `${g.id}-devtools`,
      name: "ModBuddy",
      logo: path.join("icons", "modbuddy.png"),
      queryPath: () =>
        util.GameStoreHelper.findByAppId([g.devToolsSteamId]).then((entry) => entry.gamePath),
      executable: () => path.join("Binaries", "Win32", "ModBuddy", "XCOM ModBuddy.exe"),
      requiredFiles: [path.join("Binaries", "Win32", "ModBuddy", "XCOM ModBuddy.exe")],
    },
  ];
}

// Installer

const isXComMod = (file: string) => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase();

function testMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const supported = GAMES.some((g) => g.id === gameId) && files.some(isXComMod);
  return Promise.resolve({ supported, requiredFiles: [] });
}

async function installMod(files: string[]): Promise<types.IInstallResult> {
  const modFiles = files.filter(isXComMod);

  const attributes: types.IInstruction[] = [
    { type: "attribute", key: "xComMods", value: modFiles.map((f) => path.basename(f, MOD_EXT)) },
  ];

  const copy: types.IInstruction[] = modFiles.flatMap((mod) => {
    const modName = path.basename(mod, MOD_EXT);
    const modFolder = path.dirname(mod);
    return files
      .filter((file) => file.indexOf(modFolder) !== -1 && !file.endsWith(path.sep))
      .map((file) => ({
        type: "copy" as const,
        source: file,
        destination: path.join(
          modName,
          modFolder !== "." ? file.substr(file.indexOf(modFolder) + modFolder.length) : file,
        ),
      }));
  });

  return { instructions: [...copy, ...attributes] };
}

// Load order

function validate(_prev: types.LoadOrder, cur: types.LoadOrder): Promise<types.IValidationResult> {
  const invalid = cur
    .filter((entry) => entry.name.includes('"'))
    .map((entry) => ({ id: entry.id, reason: "contains invalid characters." }));
  if (invalid.length) return Promise.resolve({ invalid });
  return Promise.resolve(undefined as unknown as types.IValidationResult);
}

async function deserializeLoadOrder(
  api: types.IExtensionApi,
  game: GameDef,
): Promise<types.LoadOrder> {
  const gamePath = discoverPath(api, game.id);
  const fullModsPath = path.join(gamePath, modsPath(game));

  // Scan installed mod folders that contain a matching .XComMod file
  const folders: string[] = [];
  try {
    for (const entry of await fs.readdirAsync(fullModsPath)) {
      try {
        const stat = await fs.statAsync(path.join(fullModsPath, entry));
        if (!stat.isDirectory()) continue;
        await fs.statAsync(path.join(fullModsPath, entry, `${entry}${MOD_EXT}`));
        folders.push(entry);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT")
          log("warn", "Error checking for XComMod file in mod folder", err);
      }
    }
  } catch (err) {
    log("error", `Error reading ${game.id} mods folder`, err);
  }

  // Get deployed files from manifest
  let deployedFiles: { relPath: string; source: string }[] = [];
  try {
    deployedFiles = (await util.getManifest(api, "", game.id)).files;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT")
      log("error", `Error reading manifest for ${game.id}`, err);
  }

  // Scan Steam Workshop mods if installed via Steam
  const workshopMods: string[] = [];
  if (gamePath.toLowerCase().includes("steamapps")) {
    const steamApps = gamePath.substr(0, gamePath.indexOf("common"));
    const workshopDir = path.join(steamApps, "workshop", "content", STEAM_ID);
    try {
      for (const cur of ((await fs.readdirAsync(workshopDir)) as string[]).filter(
        (f: string) => !path.extname(f),
      )) {
        try {
          const wsFiles = (await fs.readdirAsync(path.join(workshopDir, cur))) as string[];
          const modFile = wsFiles.find(isXComMod);
          if (modFile) workshopMods.push(path.basename(modFile, MOD_EXT));
        } catch {
          // skip unreadable workshop folders
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT")
        log("warn", `Error reading workshop mods for ${game.id}`, err);
    }
  }

  // Read enabled mods from the options INI
  let enabledMods: string[] = [];
  try {
    const file = await fs.readFileAsync(path.join(gamePath, configPath(game), MOD_OPTIONS), "utf8");
    enabledMods = (file as string)
      .split("\n")
      .filter((line: string) => line.startsWith("ActiveMods="))
      .map((m: string) => m.replace("ActiveMods=", "").replace(/"/g, ""))
      .filter((name: string) => folders.includes(name) || workshopMods.includes(name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      log("info", `${MOD_OPTIONS} does not exist for ${game.id}`);
    else log("error", `Error reading ${MOD_OPTIONS} for ${game.id}`, err);
  }

  return [...new Set([...enabledMods, ...folders, ...workshopMods])].map((xmod) => {
    const xmodPath = path.join(xmod, `${xmod}${MOD_EXT}`);
    const deployed = deployedFiles.find((f) => f.relPath.toLowerCase() === xmodPath.toLowerCase());
    return {
      id: workshopMods.includes(xmod) ? `steam-${xmod.toLowerCase()}` : xmod.toLowerCase(),
      name: xmod,
      enabled: enabledMods.includes(xmod),
      modId: deployed?.source,
    };
  });
}

async function serializeLoadOrder(
  api: types.IExtensionApi,
  loadOrder: types.LoadOrder,
  game: GameDef,
): Promise<void> {
  const gamePath = discoverPath(api, game.id);
  const mods = loadOrder.filter((e) => e.enabled).map((e) => e.name);
  await fs.writeFileAsync(
    path.join(gamePath, configPath(game), MOD_OPTIONS),
    `;Generated by Vortex ${getAppVersion()} (https://www.nexusmods.com/about/vortex/)\n` +
      "[Engine.XComModOptions]\n" +
      mods.map((mod) => `ActiveMods="${mod}"`).join("\n") +
      '\n\n;Use the below pattern to activate mods (no "+"/"-" etc. operators as this is the base INI file)\n' +
      ';ActiveMods="TerrorFromTheDerp"\n' +
      ';ActiveMods="Squadsize_EU"',
    { encoding: "utf-8" },
  );
}

// Main

function main(context: types.IExtensionContext): boolean {
  for (const game of GAMES) {
    context.registerGame({
      id: game.id,
      name: game.name,
      logo: game.logo,
      queryArgs: QUERY_ARGS,
      queryModPath: () => modsPath(game),
      executable: () => exePath(game),
      setup: (discovery) => fs.ensureDirWritableAsync(path.join(discovery.path!, modsPath(game))),
      requiredFiles: game.requiredFiles,
      supportedTools: supportedTools(game),
      parameters: LAUNCH_PARAMS,
      details: { gogAppId: GOG_ID, ...game.extraDetails },
    });

    context.registerLoadOrder({
      gameId: game.id,
      validate,
      deserializeLoadOrder: () => deserializeLoadOrder(context.api, game),
      serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder, game),
      toggleableEntries: true,
      usageInstructions:
        `This page shows a list of all XCOM 2 mods you have installed with Vortex, Steam Workshop or manually.<br/><br/>` +
        `Use the checkboxes on this page to enable or disable the mods. Enabled mods will be added to ${MOD_OPTIONS} in the ${configPath(game)} folder and will be loaded by the game.`,
    });
  }

  context.registerInstaller("xcom2-installer", 25, testMod, installMod);

  // Character-pool installer (`.bin` archives) + the mod-type it routes to.
  // The mod-type's install path is `XComGame/CharacterPool/Importable/`
  // under the active game's discovered path; WOTC nests one folder deeper
  // because its `baseDir` is `XCom2-WarOfTheChosen`.
  context.registerModType(
    XCOM2_MOD_TYPES.characterPool,
    25,
    (gameId) => gameId === XCOM2_GAME_IDS.base || gameId === XCOM2_GAME_IDS.wotc,
    (game) => {
      const def = GAMES.find((g) => g.id === game.id);
      if (!def) return undefined;
      const state = context.api.store!.getState();
      const discovery = util.getSafe(
        state,
        ["settings", "gameMode", "discovered", game.id],
        undefined,
      ) as types.IDiscoveryResult | undefined;
      if (!discovery?.path) return undefined;
      return path.join(discovery.path, def.baseDir, "XComGame", "CharacterPool", "Importable");
    },
    () => Promise.resolve(false),
    { name: "Character Pool", mergeMods: true },
  );

  util.declareInstallers(context, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
  util.declareInstallers(context, XCOM2_GAME_IDS.wotc, XCOM2_INSTALLER_SPECS);

  // Config / localisation drop-in installer + its modType. Install path is
  // the game's discovered root (no baseDir); the install function emits
  // `XCom2-WarOfTheChosen/...` destinations when the file belongs in the WOTC
  // subtree, so a single modType covers both game ids.
  context.registerModType(
    XCOM2_MOD_TYPES.configDropIn,
    25,
    (gameId) => gameId === XCOM2_GAME_IDS.base || gameId === XCOM2_GAME_IDS.wotc,
    (game) => {
      const state = context.api.store!.getState();
      const discovery = util.getSafe(
        state,
        ["settings", "gameMode", "discovered", game.id],
        undefined,
      ) as types.IDiscoveryResult | undefined;
      return discovery?.path;
    },
    () => Promise.resolve(false),
    { name: "Config / Localisation Drop-in", mergeMods: true },
  );

  context.registerInstaller(
    XCOM2_MOD_TYPES.configDropIn,
    XCOM2_CONFIG_DROP_IN_PRIORITY,
    testConfigDropIn,
    installConfigDropIn,
  );

  // Save-game modType. Saves don't live in the game install — they live in
  // the user's documents directory under "My Games/<gameDocsDir>/XComGame/
  // SaveData/". The docs-dir name differs from the game's baseDir: XCOM 2
  // vanilla uses "XCOM2" while WOTC uses "XCOM2 War of the Chosen".
  context.registerModType(
    XCOM2_MOD_TYPES.save,
    25,
    (gameId) => gameId === XCOM2_GAME_IDS.base || gameId === XCOM2_GAME_IDS.wotc,
    (game) => {
      const docsRoot = util.getVortexPath("documents");
      const gameDocsDir = game.id === XCOM2_GAME_IDS.wotc ? "XCOM2 War of the Chosen" : "XCOM2";
      return path.join(docsRoot, "My Games", gameDocsDir, "XComGame", "SaveData");
    },
    () => Promise.resolve(false),
    { name: "Save Game", mergeMods: true },
  );

  for (const check of healthChecks) {
    context.registerHealthCheck(check);
  }

  return true;
}

export default main;
