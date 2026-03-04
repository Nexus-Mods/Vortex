import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import * as path from "node:path";
import { rolldown, defineConfig } from "rolldown";

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
 * @param {import("rolldown").InputOptions} input
 * @param {string} output
 * @returns {import("rolldown").RolldownOptions}
 * */
export function createConfig(input, output) {
  const externals = getExternals();

  return defineConfig({
    input: input,
    external: externals,
    platform: "node",
    output: {
      file: output,
      format: "commonjs",
      dynamicImportInCjs: false,
      minify: true,
    },
  });
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
