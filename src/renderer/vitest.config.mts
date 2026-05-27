import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],

    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "src/**/__tests__/*"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // original-fs is provided by Electron at runtime and has no node_modules
      // entry, so under Vite/vitest we resolve it to Node's built-in fs.
      "original-fs": "node:fs",
    },
  },
});
