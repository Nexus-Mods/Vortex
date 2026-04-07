import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig[] = defineConfig([
  {
    entry: "./src/browser/lib.ts",
    platform: "browser",
    format: ["esm"],
    outDir: "./dist/browser",
    tsconfig: "./tsconfig.browser.json",
    dts: {
      sourcemap: true,
    },
  },

  {
    entry: "./src/node/lib.ts",
    platform: "node",
    format: ["cjs", "esm"],
    outDir: "./dist/node",
    tsconfig: "./tsconfig.node.json",
    dts: {
      sourcemap: true,
    },
  },
]);

export default config;
