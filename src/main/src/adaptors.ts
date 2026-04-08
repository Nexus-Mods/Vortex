import type { IMessageHandler } from "@vortex/adaptor-api";
import type { PathResolver } from "@vortex/fs";
import type { Serializable } from "@vortex/shared/ipc";

import { QualifiedPath } from "@vortex/fs";
import * as fs from "node:fs";
import * as path from "node:path";

import { FileSystemBackendImpl } from "./filesystem/fs";
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

function createPathResolver(): PathResolver {
  if (process.platform === "linux") {
    return new LinuxPathProviderImpl();
  }
  // TODO: Add WindowsPathProviderImpl when available
  throw new Error(`No PathResolver available for platform: ${process.platform}`);
}

/**
 * Creates the host-side filesystem handler.
 * Parses QualifiedPath args from RPC, resolves via PathResolver,
 * and delegates to FileSystemBackendImpl.
 *
 * TODO: Replace manual resolution with a composed FileSystem instance
 * (PathResolver + FileSystemBackend) once that layer exists in @vortex/fs.
 */
function createFileSystemHandler(): IMessageHandler {
  const resolver = createPathResolver();
  const backend = new FileSystemBackendImpl();

  function resolve(arg: unknown): Promise<string> {
    if (typeof arg !== "string") {
      throw new Error(`Expected string argument for path resolution, got ${typeof arg}`);
    }
    return resolver.resolve(QualifiedPath.parse(arg));
  }

  return async (msg) => {
    const payload = msg.payload;
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("method" in payload) ||
      typeof (payload as Record<string, unknown>).method !== "string" ||
      !("args" in payload) ||
      !Array.isArray((payload as Record<string, unknown>).args)
    ) {
      throw new Error("Invalid filesystem IPC payload: expected { method: string, args: unknown[] }");
    }
    const { method, args } = payload as { method: string; args: unknown[] };

    switch (method) {
      case "copy": {
        const source = await resolve(args[0]);
        const target = await resolve(args[1]);
        const options = args[2] as { overwrite: boolean } | undefined;
        return backend.copy(source, target, options);
      }
      case "move": {
        const source = await resolve(args[0]);
        const target = await resolve(args[1]);
        const options = args[2] as { overwrite: boolean } | undefined;
        return backend.move(source, target, options);
      }
      case "readFile":
        return backend.readFile(await resolve(args[0]));
      case "writeFile":
        return backend.writeFile(
          await resolve(args[0]),
          args[1] as Uint8Array,
        );
      case "createDirectory":
        return backend.createDirectory(await resolve(args[0]));
      case "delete":
        return backend.delete(await resolve(args[0]));
      case "deleteRecursive":
        return backend.deleteRecursive(await resolve(args[0]));
      case "stat":
        return backend.stat(
          await resolve(args[0]),
          args[1] as { parseSymLink: boolean } | undefined,
        );
      default:
        throw new Error(`Unknown method on filesystem service: ${method}`);
    }
  };
}

// Host-provided services
const HOST_SERVICES: Record<string, IMessageHandler> = {
  "vortex:host/filesystem": createFileSystemHandler(),
  "vortex:host/ping": (msg) => {
    const payload = msg.payload as { method: string; args: string[] };
    if (payload.method === "ping") {
      return Promise.resolve(`pong: ${payload.args[0]}`);
    }
    if (payload.method === "health") {
      return Promise.resolve({ status: "ok" as const });
    }
    return Promise.reject(
      new Error(`Unknown method on ping service: ${payload.method}`),
    );
  },
};

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

/**
 * Initializes the adaptor host system in the main process. Discovers adaptor
 * packages and loads each into an isolated Worker via `host.loadAdaptor()`.
 * Registers IPC handlers for renderer communication.
 * Failures are caught and logged — a broken adaptor does not crash the app.
 */
export async function initAdaptorHost(): Promise<void> {
  const bootstrapPath = path.join(getVortexPath("base"), "bootstrap.mjs");
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
}
