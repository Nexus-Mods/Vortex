import { getContainer, provides } from "@nexusmods/adaptor-api";
import type { StorePathProvider } from "@nexusmods/adaptor-api";
import { Base } from "@nexusmods/adaptor-api";
import type { IGameInfoService } from "@nexusmods/adaptor-api/contracts/game-info";
import { gameInfo } from "@nexusmods/adaptor-api/contracts/game-info";
import type {
  IGameInstallerService,
  InstallMapping,
  StopPattern,
} from "@nexusmods/adaptor-api/contracts/game-installer";
import { resolveStopPatterns } from "@nexusmods/adaptor-api/contracts/game-installer";
import type { GamePaths, IGamePathService } from "@nexusmods/adaptor-api/contracts/game-paths";
import { rehydrateGamePaths } from "@nexusmods/adaptor-api/contracts/game-paths";
import type { IGameToolsService } from "@nexusmods/adaptor-api/contracts/game-tools";
import { gameTools } from "@nexusmods/adaptor-api/contracts/game-tools";
import { peHeader } from "@nexusmods/adaptor-api/contracts/game-version";
import type { VersionSource } from "@nexusmods/adaptor-api/contracts/game-version";
import type {
  IGameLoadOrderService,
  LoadOrderDefinition,
  LoadOrderEntry,
  LoadOrderState,
} from "@nexusmods/adaptor-api/contracts/load-order";
import type {
  IGamePrelaunchService,
  PrelaunchTask,
} from "@nexusmods/adaptor-api/contracts/prelaunch";
import type { FileSystem } from "@nexusmods/adaptor-api/fs";
import { QualifiedPath, type RelativePath } from "@nexusmods/adaptor-api/fs";

type CyberpunkExtras = "saves" | "preferences";
type CyberpunkPaths = GamePaths<"game" | CyberpunkExtras>;

function getFs(): FileSystem {
  return getContainer().resolve("vortex:host/filesystem") as FileSystem;
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const INFO = gameInfo({
  gameUri: "game:cyberpunk2077",
  displayName: "Cyberpunk 2077",
  steam: 1091500,
  epic: "77f2b98e2cef40c8a7437518bf420e47",
  gog: 1423049311,
  nexusMods: "cyberpunk2077",
});

@provides("vortex:adaptor/cyberpunk2077/info")
export class GameInfoService implements IGameInfoService {
  getGameInfo() {
    return Promise.resolve(INFO);
  }
}

@provides("vortex:adaptor/cyberpunk2077/paths")
export class GamePathService implements IGamePathService<CyberpunkExtras> {
  async paths(provider: StorePathProvider): Promise<CyberpunkPaths> {
    // Cyberpunk 2077 has no native Linux build. On Linux hosts, the
    // only supported configuration is Proton, in which case gameOS is
    // Windows (the game thinks it's on Windows inside the Wine prefix).
    // A gameOS of Linux means the caller handed us a native Linux
    // discovery, which cannot exist for this title.
    if (!provider.isWindows) {
      throw new Error("Cyberpunk 2077 has no native Linux build; gameOS must be Windows (Proton)");
    }

    const game = await provider.fromBase(Base.Game);
    const home = await provider.fromBase(Base.Home);
    const appData = await provider.fromBase(Base.AppData);
    const saves = home.join("Saved Games", "CD Projekt Red", "Cyberpunk 2077");
    const preferences = appData.join("Local", "CD Projekt Red", "Cyberpunk 2077");

    return { game, saves, preferences };
  }

  getVersionSource(paths: CyberpunkPaths): Promise<VersionSource> {
    const rehydrated = rehydrateGamePaths(paths);
    return Promise.resolve(peHeader(rehydrated.game.join("bin", "x64", "Cyberpunk2077.exe")));
  }
}

@provides("vortex:adaptor/cyberpunk2077/tools")
export class GameToolsService implements IGameToolsService<CyberpunkExtras> {
  getGameTools(paths: CyberpunkPaths) {
    const rehydrated = rehydrateGamePaths(paths);
    const result = gameTools({
      game: rehydrated.game.join("bin", "x64", "Cyberpunk2077.exe"),
      tools: {
        redmod: {
          executable: rehydrated.game.join("tools", "redmod", "bin", "redMod.exe"),
          name: "REDmod",
        },
      },
    });

    return Promise.resolve(result);
  }
}

/**
 * Stop-pattern set for Cyberpunk 2077 mod installation. Patterns are
 * tried in order; the first match wins. Every Cyberpunk mod installs
 * under the game install directory, so all anchors are Base.Game.
 *
 * Translated from the canonical paths documented in the community
 * redux extension (E1337Kat/cyberpunk2077_ext_redux, installers.layouts.ts).
 * Not all bespoke detection paths translate; patterns here cover the
 * common-case canonical layouts only.
 */
const CYBERPUNK_STOP_PATTERNS: readonly StopPattern<CyberpunkExtras>[] = [
  // Loose archive/.xl files at the archive root, remapped into the
  // canonical mod directory.
  {
    match: "*.{archive,xl}",
    anchor: Base.Game,
    destination: "archive/pc/mod/{basename}",
  },

  // Canonical and legacy-patch archive mods.
  { match: "**/archive/pc/{mod,patch}/**/*.{archive,xl}", anchor: Base.Game },

  // CET (Cyber Engine Tweaks) mods.
  {
    match: "**/bin/x64/plugins/cyber_engine_tweaks/mods/**",
    anchor: Base.Game,
  },
  { match: "**/bin/x64/plugins/cyber_engine_tweaks/**", anchor: Base.Game },

  // ReShade (installed into bin/x64).
  { match: "**/bin/x64/reshade-shaders/**", anchor: Base.Game },
  { match: "**/bin/x64/*.ini", anchor: Base.Game },

  // Red4Ext native plugins.
  { match: "**/red4ext/plugins/**", anchor: Base.Game },

  // REDscript sources and their config.
  { match: "**/r6/scripts/**/*.{reds,toml}", anchor: Base.Game },

  // TweakXL tweak data.
  { match: "**/r6/tweaks/**/*.{yaml,yml}", anchor: Base.Game },

  // Audioware audio mods.
  {
    match: "**/r6/audioware/**/*.{yaml,yml,wav,ogg,mp3,flac}",
    anchor: Base.Game,
  },

  // User configs (XML and JSON).
  { match: "**/r6/config/**/*.{xml,json}", anchor: Base.Game },

  // REDmod packages (self-contained mod directories under mods/).
  { match: "**/mods/**", anchor: Base.Game },

  // ASI plugins (distinct from Red4Ext -- lives in bin/x64/plugins/).
  { match: "**/bin/x64/plugins/**/*.asi", anchor: Base.Game },

  // Input Loader XML configs.
  { match: "**/r6/input/**/*.xml", anchor: Base.Game },

  // Cache files (InputContexts, UserMappings, modded cache).
  { match: "**/r6/cache/**", anchor: Base.Game },

  // Character preset files (ACU, CyberCAT).
  { match: "**/*.preset", anchor: Base.Game },

  // Engine config and tool files.
  { match: "**/engine/config/**/*.{ini,json,xml}", anchor: Base.Game },
  { match: "**/engine/tools/**", anchor: Base.Game },
];

@provides("vortex:adaptor/cyberpunk2077/installer")
export class GameInstallerService implements IGameInstallerService<CyberpunkExtras> {
  install(
    _context: StorePathProvider,
    _paths: CyberpunkPaths,
    files: readonly RelativePath[],
  ): Promise<readonly InstallMapping<CyberpunkExtras>[]> {
    return Promise.resolve(resolveStopPatterns(CYBERPUNK_STOP_PATTERNS, files));
  }
}

// ── Load Order ──────────────────────────────────────────────────────

/**
 * Cyberpunk 2077 has two independent load orders:
 *
 * 1. **Archive** -- Controls the priority of .archive and .xl files
 *    deployed to archive/pc/mod/. Higher-priority archives override
 *    lower-priority ones when they touch the same game resources.
 *
 * 2. **REDmod** -- Controls the priority of REDmod packages under
 *    the mods/ directory. REDmod is Cyberpunk's official modding
 *    framework; each mod folder is a self-contained package that the
 *    REDmod deploy tool merges before launch.
 */
const LOAD_ORDERS: LoadOrderDefinition[] = [
  {
    id: "archive",
    displayName: "Archive Load Order",
    description: "Controls the priority of .archive and .xl files in archive/pc/mod/.",
  },
  {
    id: "redmod",
    displayName: "REDmod Load Order",
    description:
      "Controls the priority of REDmod packages under mods/. " +
      "The REDmod deploy tool merges these before launch.",
  },
];

/**
 * In-memory load order state keyed by load order ID. Each entry
 * persists across calls within the adaptor's lifetime. The host
 * is responsible for long-term persistence via setEntryOrder /
 * serializeToDisk.
 */
const loadOrderState = new Map<string, LoadOrderState>();

function getOrCreateState(loadOrderId: string): LoadOrderState {
  let state = loadOrderState.get(loadOrderId);
  if (!state) {
    state = { entries: [], rules: [] };
    loadOrderState.set(loadOrderId, state);
  }
  return state;
}

@provides("vortex:adaptor/cyberpunk2077/load-order")
export class GameLoadOrderService implements IGameLoadOrderService<CyberpunkExtras> {
  getLoadOrders(_paths: CyberpunkPaths): Promise<LoadOrderDefinition[]> {
    return Promise.resolve(LOAD_ORDERS);
  }

  async getLoadOrderState(paths: CyberpunkPaths, loadOrderId: string): Promise<LoadOrderState> {
    if (loadOrderId !== "archive") {
      return getOrCreateState(loadOrderId);
    }

    const rehydrated = rehydrateGamePaths(paths);
    const modDir = rehydrated.game.join("archive", "pc", "mod");
    const modlistPath = rehydrated.game.join("archive", "pc", "mod", "modlist.txt");

    // Discover .archive files on disk
    const archiveFiles: string[] = [];
    try {
      const iter = await getFs().enumerateDirectory(modDir, {
        types: "files",
        recursive: false,
      });

      let next = await iter.next();
      while (!next.done) {
        const qp = next.value as { path: string };
        const fileName = qp.path.split("/").pop() ?? "";
        if (fileName.endsWith(".archive") || fileName.endsWith(".xl")) {
          archiveFiles.push(fileName);
        }
        next = await iter.next();
      }
    } catch {
      // Directory may not exist yet (no archive mods deployed).
      return getOrCreateState(loadOrderId);
    }

    // Read existing modlist.txt for ordering
    let existingOrder: string[] = [];
    try {
      const raw = await getFs().readFile(modlistPath);
      existingOrder = TEXT_DECODER.decode(raw)
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } catch {
      // No modlist.txt: use alphabetical order.
    }

    // Build ordered entry list: files in modlist.txt order first,
    // then any remaining files in alphabetical order.
    const orderedFiles = [
      ...existingOrder.filter((f) => archiveFiles.includes(f)),
      ...archiveFiles.filter((f) => !existingOrder.includes(f)).sort(),
    ];

    const state = getOrCreateState(loadOrderId);
    state.entries = orderedFiles.map((f) => ({
      id: f,
      name: f,
      enabled: true,
    }));

    return state;
  }

  setEntryOrder(
    _paths: CyberpunkPaths,
    loadOrderId: string,
    entries: LoadOrderEntry[],
  ): Promise<LoadOrderState> {
    const state = getOrCreateState(loadOrderId);
    state.entries = entries;
    return Promise.resolve(state);
  }

  async serializeToDisk(paths: CyberpunkPaths, loadOrderId: string): Promise<void> {
    if (loadOrderId !== "archive") {
      // REDmod load order is alphabetical by folder name; no file to write.
      return;
    }

    const rehydrated = rehydrateGamePaths(paths);
    const modDir = rehydrated.game.join("archive", "pc", "mod");
    const modlistPath = rehydrated.game.join("archive", "pc", "mod", "modlist.txt");
    const state = getOrCreateState(loadOrderId);

    // Build the modlist.txt content from the current entry order.
    // Only include enabled entries. First entry = highest priority.
    const lines = state.entries.filter((e) => e.enabled).map((e) => e.id);

    if (lines.length === 0) {
      // No entries: remove modlist.txt so the game falls back to
      // alphabetical order.
      try {
        await getFs().delete(modlistPath);
      } catch {
        // File may not exist; that's fine.
      }
      return;
    }

    const content = lines.join("\n") + "\n";
    await getFs().createDirectory(modDir);
    await getFs().writeFile(modlistPath, TEXT_ENCODER.encode(content));
  }
}

// ── Prelaunch ───────────────────────────────────────────────────────

/**
 * REDmod deploy tool needs to run before Cyberpunk launches whenever
 * the set of REDmod packages has changed. The tool merges all enabled
 * REDmod packages into the game's runtime data.
 *
 * The `conditional` flag tells the framework to call `shouldRun()`
 * before executing. This avoids a redundant deploy when mods haven't
 * changed since the last run.
 */
@provides("vortex:adaptor/cyberpunk2077/prelaunch")
export class GamePrelaunchService implements IGamePrelaunchService<CyberpunkExtras> {
  getPrelaunchTasks(paths: CyberpunkPaths): Promise<PrelaunchTask[]> {
    const rehydrated = rehydrateGamePaths(paths);
    return Promise.resolve([
      {
        id: "redmod-deploy",
        name: "REDmod Deploy",
        executable: rehydrated.game.join("tools", "redmod", "bin", "redMod.exe"),
        args: ["deploy"],
        conditional: true,
      },
    ]);
  }

  async shouldRun(paths: CyberpunkPaths, taskId: string): Promise<boolean> {
    if (taskId !== "redmod-deploy") return false;

    // Check if any REDmod packages exist under mods/.
    // If there are none, skip the deploy entirely.
    const rehydrated = rehydrateGamePaths(paths);
    const modsDir = rehydrated.game.join("mods");

    try {
      const iter = await getFs().enumerateDirectory(modsDir, {
        types: "directories",
        recursive: false,
      });
      const first = await iter.next();
      // If there's at least one subdirectory, we have REDmods.
      return !first.done;
    } catch {
      // mods/ doesn't exist: no REDmods installed.
      return false;
    }
  }
}
