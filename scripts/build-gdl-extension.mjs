import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const gdlPath = path.join(repoRoot, "game-description-language");

/**
 * Build a GDL (game.yaml) extension. The game-description-language submodule is
 * a self-contained toolchain with its own dependencies and lockfile, so Vortex's
 * own `pnpm install` does not reach into it. This ensures the submodule is
 * installed and built (using its own pinned deps), then compiles the extension's
 * game.yaml to dist/index.js. The install and build steps are skipped once their
 * outputs exist, so repeat builds only pay for them once.
 */
export async function buildGdlExtension(extensionPath) {
  if (!existsSync(gdlPath)) {
    throw new Error(
      `GDL submodule not found at ${gdlPath}. ` +
        `Run \`git submodule update --init game-description-language\` first.`,
    );
  }

  // Vortex's install does not reach into the submodule (it has its own
  // workspace), so install its dependencies on first build.
  if (!existsSync(path.join(gdlPath, "node_modules"))) {
    execSync("pnpm install --frozen-lockfile", { cwd: gdlPath, stdio: "inherit" });
  }

  // Build the GDL CLI/toolchain on first build.
  if (!existsSync(path.join(gdlPath, "dist", "cli.js"))) {
    execSync("pnpm run build", { cwd: gdlPath, stdio: "inherit" });
  }

  // Clean previous output so stale artifacts never shadow a fresh build.
  rmSync(path.join(extensionPath, "dist"), { recursive: true, force: true });

  // Dynamic import needs a file:// URL for absolute paths on Windows.
  const { buildExtension } = await import(
    pathToFileURL(path.join(gdlPath, "dist", "commands", "build.js")).href
  );
  await buildExtension({ cwd: extensionPath });
}
