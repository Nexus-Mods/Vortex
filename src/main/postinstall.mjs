import { spawnSync } from "node:child_process";

if (process.env.VORTEX_SKIP_ELECTRON_REBUILD === "1") {
  console.log("Skipping electron-rebuild because VORTEX_SKIP_ELECTRON_REBUILD=1.");
  process.exit(0);
}

if (process.env.VORTEX_DEFER_ELECTRON_REBUILD === "1") {
  console.log("Deferring electron-rebuild because VORTEX_DEFER_ELECTRON_REBUILD=1.");
  process.exit(0);
}

const result = spawnSync("pnpm", ["exec", "electron-rebuild"], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
