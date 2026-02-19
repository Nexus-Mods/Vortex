import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      target: "node22",
      lib: {
        entry: "./src/main/main.ts",
        formats: ["cjs"],
      },
      rollupOptions: {
        // NOTE(erri120): original-fs is an electron special virtual package
        external: ["original-fs"],
        output: {
          format: "cjs",
          exports: "auto",
          interop: "default",
        },
        onwarn(warning, warn) {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            console.warn(warning.message);
          }
          warn(warning);
        },
      },
      sourcemap: true,
      // electron-vite plugins
      externalizeDeps: true,
      bytecode: false,
    },
  },
  preload: {
    build: {
      lib: {
        entry: "./src/preload/index.ts",
      },
    },
  },
  renderer: {
    root: "./src",
    build: {
      rollupOptions: {
        input: "./src/index.html",
      },
    },
    plugins: [react()],
  },
});
