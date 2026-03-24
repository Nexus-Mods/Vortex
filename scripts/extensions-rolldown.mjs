import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig as createCoreConfig } from "../rolldown.base.mjs";

/**
 * Shared Rolldown helpers for bundled extensions.
 *
 * These helpers keep Vortex-provided packages external, remap native modules to
 * their runtime paths, and create the standard CommonJS build config used by
 * in-repo extensions.
 *
 * Public API:
 * - `getExternals()` returns imports that should stay as runtime dependencies
 *   instead of being bundled.
 * - `nativeRemapPlugin(mappings)` rewrites selected native imports to runtime
 *   files and marks them as external.
 * - `createConfig(input, output, customPlugins)` builds the shared extension
 *   bundling config.
 * - `bundle(config)` runs Rolldown and writes the output bundle.
 */

const packageJsonPath = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "main",
  "package.json",
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns imports that extension bundles should keep as runtime dependencies
 * instead of bundling.
 *
 * The list comes from the main-process package manifest plus a few injected
 * runtime modules. The returned matchers cover both package roots and subpaths,
 * so imports like `react` and `react/jsx-runtime` stay external.
 *
 * @returns {(string | RegExp)[]} External matchers for Rolldown.
 * @throws {Error} If `src/main/package.json` cannot be read or parsed.
 */
export function getExternals() {
  const rawPackageJson = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(rawPackageJson);

  const injectedExternals = ["electron", "vortex-api"];

  /** @type {string[]} */
  const externalIds = [
    ...new Set([
      ...builtinModules.filter((m) => !m.startsWith("_")),
      ...Object.keys(packageJson.dependencies),
      ...injectedExternals,
    ]),
  ];

  // Match both the package itself and subpaths, for example `react/jsx-runtime`.
  return externalIds.map((id) => new RegExp(`^${escapeRegExp(id)}(?:$|/)`));
}

/**
 * Creates a plugin that rewrites selected native module imports to runtime paths.
 * Use this for native modules that should be loaded from Vortex at runtime
 * rather than bundled into the extension.
 *
 * @param {Record<string, string>} mappings Native module id to runtime path mappings.
 * @returns {import("rolldown").Plugin} Rolldown plugin that leaves remapped ids external.
 */
export function nativeRemapPlugin(mappings) {
  return {
    name: "remap native",
    resolveId(id) {
      if (mappings[id]) {
        return { id: mappings[id], external: true };
      }
    },
  };
}

/**
 * Creates the standard Rolldown configuration used by bundled extensions.
 * This always produces a CommonJS build and applies the shared runtime
 * externals from `getExternals()`.
 *
 * @param {import("rolldown").InputOptions} input Entry point configuration passed to Rolldown.
 * @param {string} output Output file path for the generated CommonJS bundle.
 * @param {import("rolldown").Plugin[]} [customPlugins=[]] Extra plugins to apply after the shared defaults.
 * @returns {import("rolldown").RolldownOptions} Rolldown config ready for `bundle()`.
 */
export function createConfig(input, output, customPlugins = []) {
  const externals = getExternals();

  return createCoreConfig(input, output, "cjs", customPlugins, externals);
}

/**
 * Builds and writes an extension bundle using the supplied Rolldown config.
 *
 * @param {import("rolldown").RolldownOptions} config Fully resolved bundle config, usually from `createConfig()`.
 * @returns {Promise<void>} Resolves when the bundle has been written.
 * @throws {Error} If Rolldown cannot resolve imports or write the output bundle.
 */
export async function bundle(config) {
  const bundle = await rolldown({
    ...config,
  });

  await bundle.write(config.output);
}
