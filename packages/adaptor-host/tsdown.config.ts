import { defineConfig } from "tsdown";

// Suppress rolldown PLUGIN_TIMINGS warning (triggers in slow CI builds)
process.env.ROLLDOWN_CHECKS_PLUGIN_TIMINGS = "off";

const sharedConfig = {
  deps: {
    neverBundle: [/^@vortex\/adaptor-api/, /^vitest/],
  },
};

export default defineConfig([
  {
    entry: {
      loader: "./src/loader.ts",
      registry: "./src/registry.ts",
      transport: "./src/transport.ts",
      "testing/harness": "./src/testing/harness.ts",
      "testing/conformance": "./src/testing/conformance.ts",
    },
    format: ["esm", "commonjs"],
    dts: {
      sourcemap: true,
    },
    exports: true,
    platform: "node",
    ...sharedConfig,
  },
  {
    entry: {
      bootstrap: "./src/bootstrap.ts",
    },
    format: ["esm"],
    dts: {
      sourcemap: true,
    },
    exports: true,
    platform: "node",
    ...sharedConfig,
  },
]);
