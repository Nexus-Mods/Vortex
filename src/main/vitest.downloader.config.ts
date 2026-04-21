import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    name: "@vortex/main (downloader)",
    environment: "node",
    include: ["src/downloading/*.test.integration.ts"],
    testTimeout: 30_000,
  },
});

export default config;
