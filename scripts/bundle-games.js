"use strict";

const esbuild = require("esbuild");
const fs = require("fs-extra");
const path = require("path");
const { glob } = require("glob");

const gamesDir = path.join(__dirname, "..", "extensions", "games");
const packageJsonPath = path.join(__dirname, "..", "package.json");

function getExternalDependencies() {
  const packageJson = require(packageJsonPath);
  const deps = Object.keys(packageJson.dependencies || {});
  const devDeps = Object.keys(packageJson.devDependencies || {});

  const builtins = [
    "path",
    "fs",
    "os",
    "util",
    "events",
    "stream",
    "child_process",
    "crypto",
    "http",
    "https",
    "net",
    "url",
    "querystring",
    "zlib",
    "buffer",
    "string_decoder",
    "assert",
    "tty",
    "readline",
    "worker_threads",
  ];

  return [
    ...new Set([...deps, ...devDeps, ...builtins, "vortex-api", "electron"]),
  ];
}

async function bundleGameExtensions() {
  const externalDeps = getExternalDependencies();
  console.log(`Marking ${externalDeps.length} dependencies as external`);

  const entries = await fs.readdir(gamesDir, { withFileTypes: true });
  const gameDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("game-"))
    .map((entry) => entry.name);

  console.log(`Found ${gameDirs.length} game extensions to bundle`);

  const results = await Promise.allSettled(
    gameDirs.map(async (gameDir) => {
      const gamePath = path.join(gamesDir, gameDir);
      const indexTs = path.join(gamePath, "index.ts");
      const indexTsx = path.join(gamePath, "index.tsx");
      const indexJs = path.join(gamePath, "index.js");

      const hasIndexTs = await fs.pathExists(indexTs);
      const hasIndexTsx = await fs.pathExists(indexTsx);

      if (!hasIndexTs && !hasIndexTsx) {
        return { gameDir, skipped: true };
      }

      const entryPoint = hasIndexTs ? indexTs : indexTsx;

      try {
        await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          platform: "node",
          target: "es2020",
          format: "cjs",
          outfile: indexJs,
          external: externalDeps,
          sourcemap: true,
          logLevel: "warning",
        });

        const jsFiles = await glob("**/*.js", {
          cwd: gamePath,
          ignore: "index.js",
        });
        for (const file of jsFiles) {
          const tsFile = file.replace(".js", ".ts");
          const tsxFile = file.replace(".js", ".tsx");
          if (
            (await fs.pathExists(path.join(gamePath, tsFile))) ||
            (await fs.pathExists(path.join(gamePath, tsxFile)))
          ) {
            await fs.remove(path.join(gamePath, file));
          }
        }

        return { gameDir, success: true };
      } catch (err) {
        console.error(`Failed to bundle ${gameDir}:`, err.message);
        return { gameDir, error: err.message };
      }
    }),
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success,
  ).length;
  const skipped = results.filter(
    (r) => r.status === "fulfilled" && r.value.skipped,
  ).length;
  const failed = results.filter(
    (r) =>
      r.status === "rejected" || (r.status === "fulfilled" && r.value.error),
  );

  console.log(
    `\nBundle complete: ${successful} succeeded, ${skipped} skipped, ${failed.length} failed`,
  );

  if (failed.length > 0) {
    console.error("Failed extensions:");
    for (const result of failed) {
      if (result.status === "fulfilled") {
        console.error(`  - ${result.value.gameDir}: ${result.value.error}`);
      } else {
        console.error(`  - ${result.reason}`);
      }
    }
    process.exit(1);
  }
}

bundleGameExtensions().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
