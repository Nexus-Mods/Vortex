import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    name: "@vortex/main (adaptor)",
    environment: "node",
    include: ["src/**/*.test.integration.ts"],
    testTimeout: 30_000,
  },
});

export default config;
