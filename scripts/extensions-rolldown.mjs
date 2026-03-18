import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig as createCoreConfig } from "../rolldown.base.mjs";

const packageJsonPath = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "main",
  "package.json",
);

/** @returns {<string[]} */
export function getExternals() {
  const rawPackageJson = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(rawPackageJson);

  const injectedExternals = ["electron", "vortex-api"];

  /** @type {string[]} */
  const external = [
    ...new Set([
      ...builtinModules.filter((m) => !m.startsWith("_")),
      ...Object.keys(packageJson.dependencies),
      ...injectedExternals,
    ]),
  ];

  return external;
}

/**
 * @param {Record<string, string>} mappings
 * @return {import("rolldown").Plugin} */
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
 * @param {import("rolldown").InputOptions} input
 * @param {string} output
 * @param {import("rolldown").Plugin[]} [customPlugins=[]]
 * @returns {import("rolldown").RolldownOptions}
 * */
export function createConfig(input, output, customPlugins = []) {
  const externals = getExternals();

  return createCoreConfig(input, output, "cjs", customPlugins, externals);
}

/**
 * @param {import("rolldown").RolldownOptions} config
 * */
export async function bundle(config) {
  const bundle = await rolldown({
    ...config,
  });

  await bundle.write(config.output);
}
