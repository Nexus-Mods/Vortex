import * as fs from "node:fs";
import * as path from "node:path";

import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory, mode } from "../../rolldown.base.mjs";

/**
 * Bundle the renderer's own sources and leave every package external, as
 * Electron's renderer loads them with Node's require at runtime. The `@/`
 * tsconfig path alias points into src, so it stays bundled.
 * @param {string} id
 */
const isPackage = (id) => {
  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;
  if (id.startsWith("@/")) return false;

  return true;
};

const LAZY_EXTERNAL = "\0lazy-external:";
const LAZY_EXTERNAL_DYNAMIC = "\0lazy-external-dynamic:";

/**
 * Rolldown hoists the require() of every external import to the top of the
 * bundle, so all packages load before any renderer code runs. Webpack loaded
 * each one when the module importing it first ran, and startup depends on
 * that: some packages require("vortex-api") at load time, which only resolves
 * once extensionRequire has installed its hook.
 *
 * So each package import goes through a one-line CommonJS module that
 * requires the package. Those modules are bundled, and with
 * strictExecutionOrder each runs in the importer's place in the module order,
 * as webpack's externals did. require() calls in source are left in place.
 *
 * Dynamic import("pkg") goes through an ES module that re-exports that
 * wrapper. Rolldown imports a CommonJS module dynamically with Node's
 * interop, which makes the whole module.exports the default export. For an
 * ESM-only package (p-limit, p-queue) that is the module namespace, so
 * `const { default: pLimit } = await import("p-limit")` would get an object.
 * Re-exporting from an ES module uses the interop that honours __esModule.
 * @returns {import("rolldown").Plugin}
 */
function lazyExternals() {
  return {
    name: "vortex:lazy-externals",
    resolveId(source, importer, extra) {
      if (importer?.startsWith(LAZY_EXTERNAL_DYNAMIC)) return source;
      if (importer?.startsWith(LAZY_EXTERNAL)) return { id: source, external: true };
      if (!isPackage(source)) return null;
      if (extra.kind === "import-statement") return LAZY_EXTERNAL + source;
      if (extra.kind === "dynamic-import") return LAZY_EXTERNAL_DYNAMIC + source;
      return { id: source, external: true };
    },
    load(id) {
      if (id.startsWith(LAZY_EXTERNAL_DYNAMIC)) {
        const wrapper = JSON.stringify(LAZY_EXTERNAL + id.slice(LAZY_EXTERNAL_DYNAMIC.length));
        return `export * from ${wrapper};\nexport { default } from ${wrapper};`;
      }
      if (id.startsWith(LAZY_EXTERNAL)) {
        return `module.exports = require(${JSON.stringify(id.slice(LAZY_EXTERNAL.length))});`;
      }
      return null;
    },
  };
}

/**
 * Compress without renaming, and keep function and class names, so stack
 * traces and React component names stay readable in production builds.
 * Uses the minifier's keepNames rather than output.keepNames: the latter
 * injects a __name() helper into function bodies, which breaks code that is
 * serialized with Function.toString() (see util/elevated.ts).
 * @type {import("rolldown").OutputOptions["minify"]}
 */
const minify =
  mode === "production"
    ? { compress: { keepNames: { function: true, class: true } }, mangle: false }
    : false;

/**
 * @param {string} name the bundle name
 * @param {string} entry the entry file under src/
 * @param {object} [options]
 * @param {"cjs" | "esm"} [options.format] the output format; an ES module is written as `<name>.mjs`
 * @param {import("rolldown").Plugin[]} [options.plugins] extra plugins, e.g. for the dev loop
 */
export function rendererConfig(name, entry, { format = "cjs", plugins = [] } = {}) {
  const esm = format === "esm";
  const config = createConfig(
    path.resolve(import.meta.dirname, "src", entry),
    path.join(mainOutputDirectory, `${name}.${esm ? "mjs" : "js"}`),
    format,
    [lazyExternals(), ...plugins],
  );

  const output = config.output;
  if (output === undefined || Array.isArray(output)) {
    throw new Error("createConfig is expected to return a single output");
  }

  return {
    ...config,
    // An ES module renderer can't import packages or node: built-ins as ES
    // modules (Chromium's loader, CSP). The browser platform keeps every
    // external a require() call, which Node integration provides.
    ...(esm ? { platform: "browser" } : {}),
    tsconfig: path.resolve(import.meta.dirname, "tsconfig.json"),
    // One file per entry, as webpack produced: dynamic import() stays inline.
    // CommonJS output only gets "use strict" when told to, and the sources
    // carry no directive; an ES module is always strict.
    output: { ...output, minify, strictExecutionOrder: true, codeSplitting: false, strict: true },
  };
}

/**
 * The renderer is an ES module in dev and production alike. Rolldown's dev
 * engine (dev.mjs) only outputs ESM, and building production the same way keeps
 * the two environments the same: strict mode, how require() and the bundle
 * load, and the paths in stack traces. index.html requires renderer.js, so
 * renderer.js is a loader that adds renderer.mjs as a module script.
 */
export function writeRendererLoader() {
  fs.writeFileSync(
    path.join(mainOutputDirectory, "renderer.js"),
    [
      "// The renderer is an ES module (see src/renderer/build.mjs).",
      'const script = document.createElement("script");',
      'script.type = "module";',
      'script.src = "./renderer.mjs";',
      "document.body.appendChild(script);",
      "",
    ].join("\n"),
  );
}

export const configs = [
  rendererConfig("renderer", "renderer.tsx", { format: "esm" }),
  // The splash screen has no dev engine: plain rolldown builds it the same way in dev.
  rendererConfig("splash", "splash.ts"),
];

if (import.meta.main) {
  writeRendererLoader();
  await Promise.all(
    configs.map(async (config) => {
      const bundle = await rolldown(config);
      await bundle.write(config.output);
      await bundle.close();
    }),
  );
}
