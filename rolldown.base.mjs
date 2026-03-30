import * as path from "node:path";
import { defineConfig } from "rolldown";

export const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

export const mainOutputDirectory = path.resolve(
  import.meta.dirname,
  "src",
  "main",
  mode === "production" ? "dist" : "out",
);

/**
 * @param {import("rolldown").InputOptions} input
 * @param {string} output
 * @param {"cjs" | "esm"} format
 * @param {import("rolldown").Plugin[]} [customPlugins=[]]
 * @param {import("rolldown").ExternalOption} [external=undefined]
 * @param {Record<string, string>} [alias=undefined]
 * @returns {import("rolldown").RolldownOptions}
 * */
export function createConfig(
  input,
  output,
  format,
  customPlugins = [],
  external = undefined,
  alias = undefined,
) {
  return defineConfig({
    input: input,
    platform: "node",
    plugins: customPlugins,
    external: external,
    ...(alias !== undefined && { resolve: { alias } }),
    onLog: (level, log, defaultHandler) => {
      if (log.code === "UNRESOLVED_IMPORT") {
        defaultHandler("error", log);
        return;
      }

      defaultHandler(level, log);
    },
    transform: {
      define: {
        "process.env.NODE_ENV": `"${mode}"`,
      },
    },
    output: {
      file: output,
      format: format,
      dynamicImportInCjs: false,
      minify: mode === "production",
      comments: false,
      sourcemap: true,
      sourcemapPathTransform:
        mode === "production"
          ? undefined
          : (relativeSourcePath, sourcemapPath) => {
              // Turn relative sourcemap paths into absolute paths
              return path.resolve(
                path.dirname(sourcemapPath),
                relativeSourcePath,
              );
            },
    },
  });
}
