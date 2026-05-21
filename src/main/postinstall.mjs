import { spawnSync } from "node:child_process";

switch (process.env.VORTEX_ELECTRON_REBUILD) {
  case "skip":
    console.log("Skipping electron-rebuild because VORTEX_ELECTRON_REBUILD=skip.");
    process.exit(0);
    break;
  case "defer":
    console.log("Deferring electron-rebuild because VORTEX_ELECTRON_REBUILD=defer.");
    process.exit(0);
    break;
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
