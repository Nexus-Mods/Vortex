import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    name: "@vortex/main (integration)",
    environment: "node",
    include: ["src/**/*.test.integration.ts"],
    testTimeout: 10_000,
  },
});

export default config;
