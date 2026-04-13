import type { IMessageHandler } from "@vortex/adaptor-api";
import type { IPingService } from "@vortex/adaptor-api/contracts/ping";
import type { StorePathSnapshot } from "@vortex/adaptor-api/stores/lib";
import type { Serializable } from "@vortex/shared/ipc";

import { Base, OS, Store } from "@vortex/adaptor-api/stores/lib";
import { QualifiedPath } from "@vortex/fs";
import * as fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { posix as pathPosix } from "node:path";

import { FileSystemBackendImpl } from "./filesystem/fs";
import { createFileSystemServiceHandler } from "./filesystem/fs-service";
import { LinuxPathProviderImpl } from "./filesystem/paths.linux";
import { getVortexPath } from "./getVortexPath";
import { betterIpcMain } from "./ipc";
import { log } from "./logging";
import {
  createAdaptorHost,
  type IAdaptorHost,
  type ILoadedAdaptor,
} from "./node-adaptor-host/loader";

// Infrastructure packages — not adaptors, don't try to load them
const INFRA_PACKAGES = new Set(["adaptor-api"]);

// Host-provided services
const HOST_SERVICES: Record<string, IMessageHandler> = {
  "vortex:host/ping": (msg) => {
    const { method, args } = msg.payload as {
      method: keyof IPingService;
      args: unknown[];
    };
    if (method === "ping") {
      return Promise.resolve(`pong: ${(args as [string])[0]}`);
    }
    if (method === "health") {
      return Promise.resolve({ status: "ok" as const });
    }

    return Promise.reject(
      new Error(`Unknown method on ping service: ${method as string}`),
    );
  },
};

let filesystemService: ReturnType<
  typeof createFileSystemServiceHandler
> | null = null;

/**
 * Builds and registers the `vortex:host/filesystem` handler if a path
 * resolver is available for the current platform. Skipped with a warning
 * on platforms we haven't wired a resolver for yet (notably Windows,
 * until a `WindowsPathProvider` implementation lands).
 */
function registerFilesystemService(): void {
  if (process.platform !== "linux") {
    log(
      "info",
      "[adaptor-host] Skipping vortex:host/filesystem registration: no path resolver for platform {{platform}}",
      { platform: process.platform },
    );
    return;
  }

  const backend = new FileSystemBackendImpl();
  const resolver = new LinuxPathProviderImpl();
  filesystemService = createFileSystemServiceHandler(backend, resolver);
  HOST_SERVICES["vortex:host/filesystem"] = filesystemService.handler;
}

/**
 * Scans node_modules/@vortex/ for adaptor packages (names starting with adaptor-).
 * Excludes infrastructure packages.
 */
function discoverAdaptors(): string[] {
  const modulesPath = getVortexPath("modules");
  const scopeDir = path.join(modulesPath, "@vortex");

  let entries: string[];
  try {
    entries = fs.readdirSync(scopeDir);
  } catch {
    return [];
  }

  return entries.filter(
    (name) => name.startsWith("adaptor-") && !INFRA_PACKAGES.has(name),
  );
}

/**
 * Resolves the bundle path for an adaptor package by reading its package.json
 * `main` field. Returns the absolute path to the built bundle.
 */
function resolveAdaptorBundle(
  packageDir: string,
  pkgJson: { main?: string },
): string {
  const main = pkgJson.main;
  if (!main) {
    throw new Error(
      `Adaptor package.json at ${packageDir} has no "main" field`,
    );
  }
  return path.resolve(packageDir, main);
}

// Module-level state for the adaptor host system
let adaptorHost: IAdaptorHost | null = null;
const loadedAdaptors = new Map<string, ILoadedAdaptor>();

// ============================================================================
// Store path snapshot construction
//
// When a game is discovered, the renderer asks us to build a
// `StorePathSnapshot` for the adaptor. The snapshot carries the host OS,
// the game's runtime OS (differs on Proton — not detected here yet), and
// a pre-resolved map of every base the adaptor might need. The adaptor
// wraps this into a `StorePathProvider` without further IPC.
// ============================================================================

/**
 * Converts a native filesystem path into a `windows://` or `linux://`
 * QualifiedPath. Mirrors the renderer bridge's old `nativeToQualifiedPath`.
 *
 * TODO(proton): this only works when `os` matches the host platform. Once
 * Proton support lands and `gameOS === OS.Windows` on a Linux host, the
 * caller must first translate the native Linux path into a Wine-prefix
 * Windows path (e.g. `Z:\home\user\...` or `C:\users\steamuser\...`) and
 * pass that in. Feeding a raw Linux path through this function with
 * `os = Windows` falls past the drive-letter regex and produces
 * `windows:////home/...` — structurally malformed.
 */
function nativeToQualifiedPath(nativePath: string, os: OS): QualifiedPath {
  if (os === OS.Windows) {
    const forward = nativePath.replace(/\\/g, "/");
    const match = /^([A-Za-z]):\/?(.*)$/.exec(forward);
    if (match) {
      const drive = match[1].toUpperCase();
      const tail = match[2];
      const inner = tail.length > 0 ? `/${drive}/${tail}` : `/${drive}`;
      return QualifiedPath.parse(`windows://${inner}`);
    }
    return QualifiedPath.parse(`windows://${forward}`);
  }
  return QualifiedPath.parse(`linux://${nativePath}`);
}

/**
 * Resolves the well-known bases for Windows. Uses `os.homedir()` and
 * fixed subpaths — matches the (not-yet-in-main-process) equivalent of
 * `WindowsPathProviderImpl`.
 */
function resolveWindowsBases(): Map<Base, QualifiedPath> {
  const home = homedir();
  const toWin = (p: string): QualifiedPath =>
    nativeToQualifiedPath(p, OS.Windows);
  const out = new Map<Base, QualifiedPath>();
  out.set(Base.Home, toWin(home));
  out.set(Base.Temp, toWin(tmpdir()));
  out.set(Base.AppData, toWin(path.win32.join(home, "AppData")));
  out.set(Base.Documents, toWin(path.win32.join(home, "Documents")));
  out.set(Base.MyGames, toWin(path.win32.join(home, "Documents", "My Games")));
  return out;
}

/**
 * Resolves the well-known bases for Linux. Mirrors `LinuxPathProviderImpl`
 * (in `./filesystem/paths.linux`) for the subset the adaptor API exposes.
 */
function resolveLinuxBases(): Map<Base, QualifiedPath> {
  const home = homedir();
  const xdg = (envName: string, relative: string): string => {
    const env = process.env[envName];
    return env && env.length > 0 ? env : pathPosix.join(home, relative);
  };
  const toLin = (p: string): QualifiedPath =>
    nativeToQualifiedPath(p, OS.Linux);
  const out = new Map<Base, QualifiedPath>();
  out.set(Base.Home, toLin(home));
  out.set(Base.Temp, toLin(tmpdir()));
  out.set(Base.XdgData, toLin(xdg("XDG_DATA_HOME", ".local/share")));
  out.set(Base.XdgCache, toLin(xdg("XDG_CACHE_HOME", ".cache")));
  out.set(Base.XdgConfig, toLin(xdg("XDG_CONFIG_HOME", ".config")));
  out.set(Base.XdgState, toLin(xdg("XDG_STATE_HOME", ".local/state")));
  const xdgRuntime = process.env["XDG_RUNTIME_DIR"] ?? tmpdir();
  out.set(Base.XdgRuntime, toLin(xdgRuntime));
  return out;
}

function detectHostOS(): OS {
  if (process.platform === "win32") return OS.Windows;
  if (process.platform === "linux") return OS.Linux;
  throw new Error(
    `Adaptor host does not support platform "${process.platform}"`,
  );
}

const KNOWN_STORES: ReadonlySet<string> = new Set(Object.values(Store));

/**
 * Builds a {@link StorePathSnapshot} for a given discovery.
 *
 * The inner bases map is populated for every OS in `{baseOS, gameOS}`.
 * The `Base.Game` entry is written under both OSes — the host-side path
 * is just the native install path, and the game-side path is currently
 * the same (Proton support will later translate this through the Wine
 * prefix).
 */
function buildStorePathSnapshot(
  store: Store,
  gamePath: string,
): StorePathSnapshot {
  const baseOS = detectHostOS();
  // TODO: detect Proton on Steam/Linux and set gameOS = OS.Windows, plus
  // resolve the game-side bases out of the Wine prefix. For now the game
  // runtime matches the host.
  const gameOS = baseOS;

  const bases = new Map<OS, ReadonlyMap<Base, QualifiedPath>>();
  const platforms: OS[] = baseOS === gameOS ? [baseOS] : [baseOS, gameOS];
  for (const os of platforms) {
    const inner =
      os === OS.Windows ? resolveWindowsBases() : resolveLinuxBases();
    inner.set(Base.Game, nativeToQualifiedPath(gamePath, os));
    bases.set(os, inner);
  }

  return { store, baseOS, gameOS, bases };
}

/**
 * Initializes the adaptor host system in the main process. Discovers adaptor
 * packages and loads each into an isolated Worker via `host.loadAdaptor()`.
 * Registers IPC handlers for renderer communication.
 * Failures are caught and logged — a broken adaptor does not crash the app.
 */
export async function initAdaptorHost(): Promise<void> {
  const bootstrapPath = path.join(getVortexPath("base"), "bootstrap.mjs");
  registerFilesystemService();
  const host = createAdaptorHost(HOST_SERVICES, bootstrapPath, (level, msg) =>
    log(level, msg),
  );
  adaptorHost = host;

  registerIpcHandlers();

  let loadedCount = 0;

  const adaptorNames = discoverAdaptors();
  if (adaptorNames.length === 0) {
    log("info", "[adaptor-host] No adaptor packages found");
    return;
  }

  const scopeDir = path.join(getVortexPath("modules"), "@vortex");

  for (const name of adaptorNames) {
    const packageName = `@vortex/${name}`;
    const packageDir = path.join(scopeDir, name);

    try {
      const pkgJsonPath = path.join(packageDir, "package.json");
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
        main?: string;
        version?: string;
        "vortex:requires"?: string[];
      };
      const bundlePath = resolveAdaptorBundle(packageDir, pkgJson);

      const adaptor = await host.loadAdaptor({
        name,
        version: pkgJson.version ?? "0.0.0",
        bundlePath,
        requires: pkgJson["vortex:requires"] ?? [],
      });

      loadedAdaptors.set(name, adaptor);
      loadedCount++;
      const m = adaptor.manifest;

      log("info", "[adaptor-host] Loaded adaptor: {{name}} v{{version}}", {
        name: m.name,
        version: m.version,
      });
      log("info", "[adaptor-host]   provides: {{provides}}", {
        provides: m.provides.join(", "),
      });
    } catch (err: unknown) {
      log(
        "warn",
        "[adaptor-host] Failed to load adaptor {{package}}: {{error}}",
        {
          package: packageName,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      );
    }
  }

  log("info", "[adaptor-host] {{count}} adaptor(s) loaded", {
    count: loadedCount,
  });
}

// ============================================================================
// IPC Handlers — renderer queries adaptor services through these
// ============================================================================

function registerIpcHandlers(): void {
  /**
   * Returns the list of loaded adaptors with their manifests.
   * Renderer uses this to discover what game services are available.
   */
  betterIpcMain.handle("adaptors:list", () => {
    const result: Array<{
      name: string;
      pid: string;
      provides: string[];
      requires: string[];
    }> = [];

    for (const [name, adaptor] of loadedAdaptors) {
      result.push({
        name,
        pid: adaptor.pid,
        provides: [...adaptor.manifest.provides],
        requires: [...adaptor.manifest.requires],
      });
    }

    return result;
  });

  /**
   * Calls a service method on a loaded adaptor.
   * The renderer uses this to lazily resolve game info, paths, tools, mod types.
   */
  betterIpcMain.handle(
    "adaptors:call",
    async (
      _event: unknown,
      adaptorName: string,
      serviceUri: string,
      method: string,
      args: unknown[],
    ) => {
      const adaptor = loadedAdaptors.get(adaptorName);
      if (!adaptor) {
        throw new Error(`Adaptor not found: ${adaptorName}`);
      }
      // Adaptor calls return JSON-serializable data across the IPC boundary
      return adaptor.call(serviceUri, method, args) as Promise<Serializable>;
    },
  );

  /**
   * Builds a {@link StorePathSnapshot} for a discovered game. Electron's
   * structured-clone IPC preserves the nested `Map` but strips the
   * `QualifiedPath` prototype off the values; the adaptor's own wrapper
   * (`createStorePathProvider`) re-parses on receive.
   */
  betterIpcMain.handle(
    "adaptors:build-snapshot",
    (_event: unknown, store: string, gamePath: string) => {
      if (!KNOWN_STORES.has(store)) {
        return Promise.reject(
          new Error(
            `adaptors:build-snapshot: unknown store "${store}" (expected one of: ${[...KNOWN_STORES].join(", ")})`,
          ),
        );
      }
      if (typeof gamePath !== "string" || gamePath.trim().length === 0) {
        return Promise.reject(
          new Error(
            "adaptors:build-snapshot: gamePath must be a non-empty string",
          ),
        );
      }
      return Promise.resolve(
        buildStorePathSnapshot(store as Store, gamePath) as unknown,
      ) as Promise<Serializable>;
    },
  );
}
