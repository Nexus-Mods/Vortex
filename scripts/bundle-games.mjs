import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";

import { createConfig, bundle } from "./extensions-rolldown.mjs";

const gamesDirectory = path.resolve(
  import.meta.dirname,
  "..",
  "extensions",
  "games",
);

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
 * */
async function bundleGame(gameDirectory) {
  const gamePath = path.resolve(gameDirectory.parentPath, gameDirectory.name);
  const entryPoint = await findEntryPoint(gamePath);
  const output = path.resolve(gamePath, "index.js");

  if (!entryPoint) {
    console.debug(
      `* Skipped: ${gameDirectory.name} due to missing entry point`,
    );
    return;
  }

  const config = createConfig(entryPoint, output);

  try {
    await bundle(config);
    console.log(`* Success: ${gameDirectory.name}`);
  } catch (err) {
    console.error(`* Failure: ${gameDirectory.name} due to error:`);
    console.error(err);
    // process.exit(1);
  }
}

async function main() {
  const entries = await readdir(gamesDirectory, { withFileTypes: true });
  const gameDirectories = entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("game-"),
  );

  console.log(`Bundling ${gameDirectories.length} game extensions`);

  for (const gameDirectory of gameDirectories) {
    await bundleGame(gameDirectory);
  }
}

await main();
