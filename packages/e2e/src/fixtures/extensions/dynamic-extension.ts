/**
 * Build and prepare dynamic extension fixtures for isolated Vortex end-to-end tests.
 * In this context, 'dynamic' means an extension that does not ship bundled with
 * the Vortex App; i.e. one from an external repository.
 *
 * These helpers copy built plugin directories into `userData/plugins`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  ensureDynamicGdlGameExtensionBuilt,
  type DynamicGameExtensionId,
} from "./dynamic-game-extension";

/** Identifier for a dynamic game extension fixture supported by the shared builder. */
export type { DynamicGameExtensionId } from "./dynamic-game-extension";

/**
 * Spec for one dynamic extension fixture.
 *
 * Each entry maps a test-facing extension id to its build source and plugin id.
 */
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

/** Identifier for a dynamic extension fixture that this module can prepare. */
export type DynamicExtensionId = keyof typeof DYNAMIC_EXTENSIONS;

/** Result of preparing one dynamic extension into a Vortex user-data directory. */
export interface PreparedDynamicExtension {
  /** Absolute path to the prepared plugin directory under `userData/plugins`. */
  destination: string;
  /** Test-facing identifier used to select the fixture. */
  id: DynamicExtensionId;
  /** Plugin id written into the Vortex user-data tree. */
  pluginId: string;
  /** Absolute path to the built source copied into the fixture directory. */
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

/**
 * Prepare multiple dynamic extensions into one Vortex user-data directory.
 *
 * @param vortexUserDataDir - Root directory for the isolated Vortex instance.
 * @param extensionIds - Dynamic extension ids to build and copy.
 * @returns Metadata for each prepared extension.
 * @throws Error When a fixture from `external/gdl-games` is requested before that submodule is initialized.
 * @throws Error When a workspace fixture package is missing its `package.json`.
 * @throws Error When `pnpm` fails while installing, initializing, or building a requested fixture, or when the built `dist` directory is missing its entry file or `info.json`.
 * @throws NodeJS.ErrnoException When removing, creating, or copying a fixture directory under `userData/plugins` fails.
 */
export function prepareDynamicExtensions(
  vortexUserDataDir: string,
  extensionIds: readonly DynamicExtensionId[],
): PreparedDynamicExtension[] {
  return extensionIds.map((extensionId) => prepareDynamicExtension(vortexUserDataDir, extensionId));
}

/**
 * Prepare one dynamic extension into a Vortex user-data directory.
 *
 * @param vortexUserDataDir - Root directory for the isolated Vortex instance.
 * @param extensionId - Dynamic extension id to build and copy.
 * @returns Metadata for the prepared extension.
 * @throws Error When a fixture from `external/gdl-games` is requested before that submodule is initialized.
 * @throws Error When the workspace fixture package is missing its `package.json`.
 * @throws Error When `pnpm` fails while installing, initializing, or building the fixture, or when the built `dist` directory is missing its entry file or `info.json`.
 * @throws NodeJS.ErrnoException When removing the old plugin directory, creating `userData/plugins`, or copying the fixture fails.
 */
export function prepareDynamicExtension(
  vortexUserDataDir: string,
  extensionId: DynamicExtensionId,
): PreparedDynamicExtension {
  const spec = specFor(extensionId);
  const source = ensureDynamicExtensionBuilt(extensionId);
  const destination = dynamicExtensionDestination(vortexUserDataDir, extensionId);

  // Replace any stale fixture copy before writing the fresh build output.
  fs.rmSync(destination, { recursive: true, force: true });
  // Recreate the parent plugin directory so the copy has a stable target.
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // Copy the built extension into the isolated Vortex user-data tree.
  fs.cpSync(source, destination, { recursive: true });

  return {
    destination,
    id: extensionId,
    pluginId: spec.pluginId,
    source,
  };
}

/**
 * Build the requested dynamic extension if its dist directory is missing.
 *
 * @param extensionId - Dynamic extension id to build.
 * @returns Absolute path to the built dist directory.
 * @throws Error When a fixture from `external/gdl-games` is requested before that submodule is initialized.
 * @throws Error When the workspace fixture package is missing its `package.json`.
 * @throws Error When `pnpm` fails while installing, initializing, or building the requested fixture.
 * @throws Error When the built `dist` directory is missing its entry file or `info.json`.
 */
export function ensureDynamicExtensionBuilt(extensionId: DynamicExtensionId): string {
  const spec = specFor(extensionId);
  switch (spec.kind) {
    case "gdl":
      return ensureDynamicGdlGameExtensionBuilt(spec.gameId);
    case "workspace-extension":
      return ensureWorkspaceExtensionBuilt(extensionId, spec);
  }
}

/**
 * Resolve the Vortex plugin destination for one dynamic extension.
 *
 * @param vortexUserDataDir - Root directory for the isolated Vortex instance.
 * @param extensionId - Dynamic extension id to resolve.
 * @returns Absolute path to the plugin destination directory.
 */
export function dynamicExtensionDestination(
  vortexUserDataDir: string,
  extensionId: DynamicExtensionId,
): string {
  const { pluginId } = specFor(extensionId);
  return path.join(vortexUserDataDir, "userData", "plugins", pluginId);
}

/**
 * Build one workspace extension fixture when its `dist` output is missing.
 *
 * @param extensionId - Dynamic extension id used in validation errors.
 * @param spec - Workspace package metadata and expected entry file.
 * @returns Absolute path to the built `dist` directory.
 * @throws Error When the workspace package is missing or the build output is incomplete.
 */
function ensureWorkspaceExtensionBuilt(
  extensionId: DynamicExtensionId,
  spec: Extract<DynamicExtensionSpec, { kind: "workspace-extension" }>,
): string {
  const distDir = workspaceDistDir(spec);
  if (hasBuiltExtension(distDir, spec.entryFile)) return distDir;

  if (!fs.existsSync(path.join(spec.sourcePath, "package.json"))) {
    throw new Error(`Missing workspace extension package at ${spec.sourcePath}`);
  }

  // Build from the repo root so pnpm can resolve the workspace package filter.
  run("pnpm", ["--filter", spec.packageName, "run", "build"], REPO_ROOT);

  // Validate expected entry file and manifest before preparing fixture.
  validateBuiltExtension(extensionId, distDir, spec.entryFile);
  return distDir;
}

/**
 * Resolve the workspace package output directory for a dynamic extension.
 *
 * @param spec - Workspace extension metadata.
 * @returns Absolute path to the workspace `dist` directory.
 */
function workspaceDistDir(spec: Extract<DynamicExtensionSpec, { kind: "workspace-extension" }>) {
  return path.join(spec.sourcePath, "dist");
}

/**
 * Check whether a built extension already has the required output files.
 *
 * @param distDir - Built output directory to inspect.
 * @param entryFile - Entry file that must exist beside `info.json`.
 * @returns True when the expected files are present.
 */
function hasBuiltExtension(distDir: string, entryFile: "index.cjs" | "index.js"): boolean {
  return (
    fs.existsSync(path.join(distDir, entryFile)) && fs.existsSync(path.join(distDir, "info.json"))
  );
}

/**
 * Run a build command in a specific working directory.
 *
 * @param command - Command to execute.
 * @param args - Command arguments.
 * @param cwd - Working directory for the child process.
 */
function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
}

/**
 * Check that a built extension includes files Vortex loads during fixture preparation.
 *
 * @param extensionId - Dynamic extension id used in validation errors.
 * @param distDir - Built output directory to inspect.
 * @param entryFile - Entry file that must exist beside `info.json`.
 * @throws Error When the built output is missing required files.
 */
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

/**
 * Resolve the static metadata for one dynamic extension fixture id.
 *
 * @param extensionId - Dynamic extension id to resolve.
 * @returns Fixture metadata for the requested id.
 */
function specFor(extensionId: DynamicExtensionId): (typeof DYNAMIC_EXTENSIONS)[DynamicExtensionId] {
  return DYNAMIC_EXTENSIONS[extensionId];
}
