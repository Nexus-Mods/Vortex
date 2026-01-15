import { defineConfig } from 'electron-vite';
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: "./src/main.ts"
      },
      rollupOptions: {
        external: ["original-fs"],
        output: {
          format: "cjs",
          exports: "auto"
        }
      },
      // electron-vite plugins
      externalizeDeps: true,
      bytecode: false
    }
  },
  preload: {
    build: {
      lib: {
        entry: "./src/preload.ts"
      }
    }
  },
  renderer: {
    root: "./src",
    build: {
      rollupOptions: {
        input: "./src/index.html",
      }
    },
    plugins: [react()]
  }
});


