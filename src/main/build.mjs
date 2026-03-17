import { rolldown, defineConfig } from "rolldown";
import * as path from "node:path";

const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.resolve(
  import.meta.dirname,
  mode === "production" ? "dist" : "out",
  "main.mjs",
);

const packagesToBundle = ["@vortex/shared"];

const config = defineConfig({
  input: INPUT,
  platform: "node",
  external: (id) => {
    if (packagesToBundle.find((pkg) => id.startsWith(pkg))) return false;

    const isRelativePath = id.startsWith(".");
    const isAbsolutePath = path.isAbsolute(id);
    return !isRelativePath && !isAbsolutePath;
  },
  transform: {
    define: {
      "process.env.NODE_ENV": `"${mode}"`,
    },
  },
  output: {
    file: OUTPUT,
    format: "esm",
    comments: false,
    dynamicImportInCjs: false,
    minify: mode === "production",
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

const bundle = await rolldown(config);
await bundle.write(config.output);
