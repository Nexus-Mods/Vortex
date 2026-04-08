import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/lib.ts",
    plugin: "./src/plugin.ts",
    "contracts/ping": "./src/contracts/ping.ts",
    "contracts/filesystem": "./src/contracts/filesystem.ts",
    "contracts/game-info": "./src/contracts/game-info.ts",
    "contracts/game-mod-types": "./src/contracts/game-mod-types.ts",
    "contracts/game-paths": "./src/contracts/game-paths.ts",
    "contracts/game-tools": "./src/contracts/game-tools.ts",
    "types/store-ids": "./src/types/store-ids.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    sourcemap: true,
  },
  exports: {
    devExports: "development",
  },
  platform: "neutral",
});
