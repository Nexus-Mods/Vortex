import { defineConfig, type ViteUserConfig } from "vitest/config";
import { doctest } from "vite-plugin-doctest";

const config: ViteUserConfig = defineConfig({
  plugins: [doctest()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    includeSource: ["src/fs/paths.ts", "src/fs/matcher.ts"],
  },
});

export default config;
