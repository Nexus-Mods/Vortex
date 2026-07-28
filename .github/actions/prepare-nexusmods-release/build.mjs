import { rolldown, defineConfig } from "rolldown";

// GitHub Actions runs dist/index.js as-is at invocation time - it never installs
// dependencies - so the bundle is self-contained and committed to the repo.
// Output is kept independent of NODE_ENV to avoid churn in the committed file.
const config = defineConfig({
  input: "./src/index.ts",
  platform: "node",
  onLog: (level, log, defaultHandler) => {
    if (log.code === "UNRESOLVED_IMPORT") {
      defaultHandler("error", log);
      return;
    }

    defaultHandler(level, log);
  },
});

const bundle = await rolldown(config);

await bundle.write({
  file: "./dist/index.js",
  format: "cjs",
  minify: false,
  sourcemap: false,
});
