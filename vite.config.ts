import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import renderer from 'vite-plugin-electron-renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "./src",
  define: {
    "process.env": {},
  },
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
    alias: {
      "original-fs": "./src/shims/original-fs.ts",
    }
  },
  optimizeDeps: {
    exclude: [
      "original-fs",
      "electron",
    ]
  },
  esbuild: {
    platform: "node",
  },
  build: {
    target: "node22",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src", "index.vite.html")
      },
      external: ["original-fs", "electron"],
    },
  },
  plugins: [react(), renderer()],
});

