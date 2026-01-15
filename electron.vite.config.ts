import { defineConfig } from 'electron-vite';
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: "./src/main.ts",
        formats: ["es"]
      },
      rollupOptions: {
        external: ["original-fs"]
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: ""
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

