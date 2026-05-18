import { spawnSync } from "node:child_process";

if (process.env.VORTEX_SKIP_ELECTRON_REBUILD === "1") {
  console.log("Skipping electron-rebuild because VORTEX_SKIP_ELECTRON_REBUILD=1.");
  process.exit(0);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["exec", "electron-rebuild"], { stdio: "inherit" });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
