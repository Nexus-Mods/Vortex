import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    name: "@vortex/main",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.test.integration.ts"],
  },
});

export default config;
