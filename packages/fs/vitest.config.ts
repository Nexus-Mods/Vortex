import { defineConfig, type ViteUserConfig } from "vitest/config";
import { doctest } from "vite-plugin-doctest";

const config: ViteUserConfig = defineConfig({
  plugins: [doctest()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    includeSource: ["src/browser/paths.ts", "src/browser/matcher.ts"],
  },
});

export default config;
