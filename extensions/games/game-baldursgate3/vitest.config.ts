import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // divine.exe invocations can be slow on cold caches.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
