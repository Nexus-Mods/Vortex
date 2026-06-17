import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  ensureDynamicGameExtensionBuilt,
  type DynamicGameExtensionId,
} from "./dynamic-game-extension";

export type { DynamicGameExtensionId } from "./dynamic-game-extension";

type DynamicExtensionSpec =
  | {
      gameId: DynamicGameExtensionId;
      kind: "gdl";
      pluginId: string;
    }
  | {
      entryFile: "index.cjs" | "index.js";
      kind: "workspace-extension";
      packageName: string;
      pluginId: string;
      sourcePath: string;
    };

export interface SeededDynamicExtension {
  destination: string;
  id: DynamicExtensionId;
  pluginId: string;
  source: string;
}

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");

const DYNAMIC_EXTENSIONS = {
  gothic1remake: {
    gameId: "gothic1remake",
    kind: "gdl",
    pluginId: "gothic1remake",
  },
  "open-directory-e2e": {
    entryFile: "index.cjs",
    kind: "workspace-extension",
    packageName: "open-directory",
    pluginId: "open-directory-e2e",
    sourcePath: path.join(REPO_ROOT, "extensions", "open-directory"),
  },
} as const satisfies Record<string, DynamicExtensionSpec>;

export type DynamicExtensionId = keyof typeof DYNAMIC_EXTENSIONS;

function specFor(extensionId: DynamicExtensionId): DynamicExtensionSpec {
  return DYNAMIC_EXTENSIONS[extensionId];
}

function workspaceDistDir(spec: Extract<DynamicExtensionSpec, { kind: "workspace-extension" }>) {
  return path.join(spec.sourcePath, "dist");
}

function hasBuiltExtension(distDir: string, entryFile: "index.cjs" | "index.js"): boolean {
  return (
    fs.existsSync(path.join(distDir, entryFile)) && fs.existsSync(path.join(distDir, "info.json"))
  );
}

function validateBuiltExtension(
  extensionId: DynamicExtensionId,
  distDir: string,
  entryFile: "index.cjs" | "index.js",
): void {
  const missing = [entryFile, "info.json"].filter(
    (file) => !fs.existsSync(path.join(distDir, file)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Dynamic extension build did not produce ${missing.join(" and ")}: ${extensionId}`,
    );
  }
}

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
}

function ensureWorkspaceExtensionBuilt(
  extensionId: DynamicExtensionId,
  spec: Extract<DynamicExtensionSpec, { kind: "workspace-extension" }>,
): string {
  const distDir = workspaceDistDir(spec);
  if (hasBuiltExtension(distDir, spec.entryFile)) return distDir;

  if (!fs.existsSync(path.join(spec.sourcePath, "package.json"))) {
    throw new Error(`Missing workspace extension package at ${spec.sourcePath}`);
  }

  run("pnpm", ["--filter", spec.packageName, "run", "build"], REPO_ROOT);

  validateBuiltExtension(extensionId, distDir, spec.entryFile);
  return distDir;
}

export function ensureDynamicExtensionBuilt(extensionId: DynamicExtensionId): string {
  const spec = specFor(extensionId);
  switch (spec.kind) {
    case "gdl":
      return ensureDynamicGameExtensionBuilt(spec.gameId);
    case "workspace-extension":
      return ensureWorkspaceExtensionBuilt(extensionId, spec);
  }
}

export function dynamicExtensionDestination(
  vortexUserDataDir: string,
  extensionId: DynamicExtensionId,
): string {
  const { pluginId } = specFor(extensionId);
  return path.join(vortexUserDataDir, "userData", "plugins", pluginId);
}

export function seedDynamicExtension(
  vortexUserDataDir: string,
  extensionId: DynamicExtensionId,
): SeededDynamicExtension {
  const spec = specFor(extensionId);
  const source = ensureDynamicExtensionBuilt(extensionId);
  const destination = dynamicExtensionDestination(vortexUserDataDir, extensionId);

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });

  return {
    destination,
    id: extensionId,
    pluginId: spec.pluginId,
    source,
  };
}

export function seedDynamicExtensions(
  vortexUserDataDir: string,
  extensionIds: readonly DynamicExtensionId[],
): SeededDynamicExtension[] {
  return extensionIds.map((extensionId) => seedDynamicExtension(vortexUserDataDir, extensionId));
}
