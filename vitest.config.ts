import { mergeConfig } from "vitest/config";

import baseConfig from "./vitest.base.config";

export default mergeConfig(baseConfig, {
  test: {
    projects: [
      "./src/**/vitest.config.ts",
      "./src/main/vitest.downloader.config.ts",
      "./packages/**/vitest.config.ts",
      "./extensions/**/vitest.config.ts",
      "./scripts/vitest.config.ts",
    ],
  },
});
