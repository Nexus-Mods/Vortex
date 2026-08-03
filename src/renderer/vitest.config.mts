import path from "path";
import { fileURLToPath } from "url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    // Expose beforeAll/afterEach/... as globals so @testing-library/react can
    // self-register its hooks (act environment + auto-cleanup). Tests should
    // still import from "vitest" explicitly.
    globals: true,
    setupFiles: ["./test-setup.ts"],

    include: ["src/**/*.test.{ts,tsx,js,jsx}"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "original-fs": "fs",
      "modmeta-db": path.resolve(
        __dirname,
        "../../extensions/nmm-import-tool/node_modules/modmeta-db/lib/index.js",
      ),
    },
  },
});
