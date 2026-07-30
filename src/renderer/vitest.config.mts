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

    server: {
      deps: {
        // Inline so Vite transforms it and the react/jsx-runtime alias below
        // applies; left external, Node resolves the bare specifier and fails
        // against React 17's exports-less package.
        inline: ["@floating-ui/react"],
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "original-fs": "fs",
      // React 17 ships no `exports` map, so Vite cannot resolve the bare
      // `react/jsx-runtime` specifier that ESM deps (@floating-ui/react) import.
      // Webpack resolves it fine; this only affects the vitest runner.
      "react/jsx-runtime": "react/jsx-runtime.js",
      "modmeta-db": path.resolve(
        __dirname,
        "../../extensions/nmm-import-tool/node_modules/modmeta-db/lib/index.js",
      ),
    },
  },
});
