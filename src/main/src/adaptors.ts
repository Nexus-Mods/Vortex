import type { IMessageHandler } from "@vortex/adaptor-api/interfaces";
import { createAdaptorHost } from "@vortex/adaptor-host/loader";
import * as fs from "node:fs";
import * as path from "node:path";

import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";

// Infrastructure packages — not adaptors, don't try to load them
const INFRA_PACKAGES = new Set(["adaptor-api", "adaptor-host"]);

// Host-provided services
const HOST_SERVICES: Record<string, IMessageHandler> = {
  "vortex:host/ping": (msg) => {
    const payload = msg.payload as { method: string; args: string[] };
    if (payload.method === "ping") {
      return Promise.resolve(`pong: ${payload.args[0]}`);
    }
    if (payload.method === "health") {
      return Promise.resolve({ status: "ok" as const });
    }
    return Promise.reject(new Error(`Unknown method on ping service: ${payload.method}`));
  },
};

/**
 * Scans node_modules/@vortex/ for adaptor packages (names starting with adaptor-).
 * Excludes infrastructure packages (adaptor-api, adaptor-host).
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
function resolveAdaptorBundle(packageDir: string, pkgJson: { main?: string }): string {
  const main = pkgJson.main;
  if (!main) {
    throw new Error(`Adaptor package.json at ${packageDir} has no "main" field`);
  }
  return path.resolve(packageDir, main);
}

/**
 * Initializes the adaptor host system in the main process. Discovers adaptor
 * packages and loads each into an isolated Worker via `host.loadAdaptor()`.
 * Failures are caught and logged — a broken adaptor does not crash the app.
 */
export async function initAdaptorHost(): Promise<void> {
  const modulesPath = getVortexPath("modules");
  const bootstrapPath = path.join(
    modulesPath,
    "@vortex",
    "adaptor-host",
    "dist",
    "bootstrap.mjs",
  );
  const host = createAdaptorHost(
    HOST_SERVICES,
    bootstrapPath,
    (level, msg) => log(level, msg),
  );
  let loadedCount = 0;

  const adaptorNames = discoverAdaptors();
  if (adaptorNames.length === 0) {
    log("info", "[adaptor-host] No adaptor packages found");
    return;
  }

  const scopeDir = path.join(modulesPath, "@vortex");

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
          error: err instanceof Error ? err.message : String(err as string),
        },
      );
    }
  }

  log("info", "[adaptor-host] {{count}} adaptor(s) loaded", {
    count: loadedCount,
  });
}
