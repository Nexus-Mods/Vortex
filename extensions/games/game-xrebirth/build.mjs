import { execFileSync } from "node:child_process";
import { existsSync, rmSync, cpSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

// This extension is described declaratively in game.yaml and compiled by the
// Game Description Language (GDL) toolchain (the game-description-language
// submodule) into a Vortex-loadable dist/index.js. The imperative bits
// (content.xml installer, health checks) live in src/hooks.ts.

const extensionPath = path.resolve(import.meta.dirname);
const gdlPath = path.resolve(extensionPath, "..", "..", "..", "game-description-language");
const gdlDist = path.join(gdlPath, "dist");

// Ensure the GDL toolchain is built (it ships as a submodule; its node_modules
// must already be installed). Build it on demand if dist is missing.
if (!existsSync(path.join(gdlDist, "cli.js"))) {
  execFileSync(
    "node",
    [path.join(gdlPath, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    {
      cwd: gdlPath,
      stdio: "inherit",
    },
  );
  cpSync(path.join(gdlPath, "src", "templates"), path.join(gdlDist, "templates"), {
    recursive: true,
  });
  cpSync(
    path.join(gdlPath, "src", "bundler", "tsconfig.bundle.json"),
    path.join(gdlDist, "bundler", "tsconfig.bundle.json"),
  );
}

// Clean previous output so stale artifacts never shadow a fresh build.
rmSync(path.join(extensionPath, "dist"), { recursive: true, force: true });

// Dynamic import needs a file:// URL for absolute paths on Windows.
const { buildExtension } = await import(
  pathToFileURL(path.join(gdlDist, "commands", "build.js")).href
);
await buildExtension({ cwd: extensionPath });
