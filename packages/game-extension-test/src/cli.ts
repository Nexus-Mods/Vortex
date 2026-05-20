#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import * as path from "node:path";

import minimist from "minimist";

// pnpm forwards a literal "--" separator into argv; minimist treats "--" as
// stop-parsing, so strip it before parsing flags.
const argv = minimist(process.argv.slice(2).filter((a) => a !== "--"));
const all = argv.all === true || argv.all === "true";
const single = typeof argv.game === "string" ? argv.game : undefined;
const list = typeof argv.games === "string" ? argv.games.split(",") : undefined;

if (!all && !single && !list) {
  console.error("Usage: --all | --game <id> | --games <a,b,c>");
  process.exit(1);
}

const apiKey = process.env.NEXUS_API_KEY ?? "";
if (!apiKey) {
  console.error("NEXUS_API_KEY environment variable is required.");
  process.exit(1);
}

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(__dirname, "../../..");
const games = all ? "all" : (single ?? list?.join(","));

const env = {
  ...process.env,
  GAME_EXT_TEST_REPO: repoRoot,
  GAME_EXT_TEST_GAMES: games,
};

const vitestConfig = path.join(packageRoot, "vitest.fixtures.config.ts");
const result = spawnSync("pnpm", ["exec", "vitest", "run", "--config", vitestConfig], {
  stdio: "inherit",
  env,
  cwd: packageRoot,
});
process.exit(result.status ?? 1);
