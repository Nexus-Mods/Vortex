import { mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(baseConfig, {
  test: {
    name: "local-gamesettings",
    include: ["src/**/*.test.ts"],
  },
});
