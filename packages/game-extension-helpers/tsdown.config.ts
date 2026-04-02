import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    paths: "./src/paths.ts",
  },
  format: ["esm", "commonjs"],
  dts: {
    sourcemap: true,
  },
  exports: {
    customExports: {
      "./paths": {
        import: "./dist/paths.js",
        require: "./dist/paths.cjs",
        types: "./dist/paths.d.ts",
      },
    },
  },
  platform: "neutral",
});
