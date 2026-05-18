import path from "path";
import { fileURLToPath } from "url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],

    include: ["src/**/*.test.{ts,tsx,js,jsx}"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "original-fs": "fs",
      "vortex-api": path.resolve(__dirname, "../../packages/vortex-api/lib/api.js"),
      "modmeta-db": path.resolve(
        __dirname,
        "../../extensions/nmm-import-tool/node_modules/modmeta-db/lib/index.js",
      ),
    },
  },
});
