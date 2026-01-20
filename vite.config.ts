import react from "@vitejs/plugin-react";
import renderer from 'vite-plugin-electron-renderer';
import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
      "original-fs": resolve(__dirname, "src/shims/original-fs.ts"),
    }
  },
  optimizeDeps: {
    noDiscovery: true,
    include: undefined
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
      external: ["original-fs", "electron", "winapi"],
    },
  },
  plugins: [react(), renderer()],
});

