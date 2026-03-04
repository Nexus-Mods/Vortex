import { rolldown } from "rolldown";
import * as path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { builtinModules } from "node:module";

const gamesDirectory = path.resolve(
  import.meta.dirname,
  "..",
  "extensions",
  "games",
);
const packageJsonPath = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "main",
  "package.json",
);

/** @returns {Promise<string[]>} */
async function getExternals() {
  const rawPackageJson = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(rawPackageJson);

  const injectedExternals = ["electron", "vortex-api"];

  /** @type {string[]} */
  const external = [
    ...new Set([
      ...builtinModules.filter((m) => !m.startsWith("_")),
      ...Object.keys(packageJson.dependencies),
      ...injectedExternals,
    ]),
  ];

  return external;
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} directory
 * @returns {Promise<string | null>}
 * */
async function findEntryPoint(directory) {
  const indexTS = path.resolve(directory, "index.ts");
  if (await exists(indexTS)) {
    return indexTS;
  }

  const indexTSX = path.resolve(directory, "index.tsx");
  if (await exists(indexTSX)) {
    return indexTSX;
  }

  return null;
}

/**
 * @param {import("node:fs").Dirent<string>} gameDirectory
 * @param {string[]} externals
 * */
async function bundleGame(gameDirectory, externals) {
  const gamePath = path.resolve(gameDirectory.parentPath, gameDirectory.name);
  const entryPoint = await findEntryPoint(gamePath);
  const output = path.resolve(gamePath, "index.js");

  if (!entryPoint) {
    console.debug(
      `* Skipped: ${gameDirectory.name} due to missing entry point`,
    );
    return;
  }

  try {
    const bundle = await rolldown({
      input: entryPoint,
      external: externals,
      platform: "node",
      onLog: (level, log, defaultHandler) => {
        if (log.code !== "UNRESOLVED_IMPORT") {
          defaultHandler(level, log);
          return;
        }

        defaultHandler("error", log);
      },
    });

    await bundle.write({
      file: output,
      format: "commonjs",
      dynamicImportInCjs: false,
      minify: true,
    });

    console.log(`* Success: ${gameDirectory.name}`);
  } catch (err) {
    console.error(`* Failure: ${gameDirectory.name} due to error:`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  const externals = await getExternals();
  console.log(`Using ${externals.length} external dependencies`);

  const entries = await readdir(gamesDirectory, { withFileTypes: true });
  const gameDirectories = entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("game-"),
  );

  console.log(`Bundling ${gameDirectories.length} game extensions`);

  for (const gameDirectory of gameDirectories) {
    await bundleGame(gameDirectory, externals);
  }
}

await main();
