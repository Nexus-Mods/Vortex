/**
 * Collects the per-project `.lint-results.json` files written by
 * scripts/strict-lint.mjs (APP-537) after `nx run-many -t lint:strict`
 * and stages them for upload to the Vortex reports bucket (PLAENG-845):
 *
 *   .lint-staging/<date>-<runid>.json                  per-run index
 *   .lint-staging/raw/<date>-<runid>/<projectName>.json  raw oxlint JSON
 *
 * Usage:
 *   node scripts/collect-lint-results.mjs
 *
 * Expects the GitHub Actions default environment variables (GITHUB_RUN_ID,
 * GITHUB_SHA, GITHUB_REPOSITORY, GITHUB_SERVER_URL); a missing one aborts
 * with a clear error rather than staging mislabeled data.
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STAGING_DIR = path.join(ROOT, ".lint-staging");

const SKIPPED_DIRS = new Set([
  "node_modules",
  "dist",
  "dist_custom",
  "dist_portable",
  "dist_web",
  "out",
  "coverage",
  ".git",
  ".nx",
]);

/** Walk the repo for `.lint-results.json` files, skipping build/dependency trees. */
function findResults(dir = ROOT, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === ".lint-results.json") {
      acc.push(path.join(dir, entry.name));
    } else if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      findResults(path.join(dir, entry.name), acc);
    }
  }

  return acc;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`Missing $${name}; run this from a GitHub Actions step.`);
    process.exit(1);
  }

  return value;
}

const runId = requiredEnv("GITHUB_RUN_ID");
const sha = requiredEnv("GITHUB_SHA");
const repository = requiredEnv("GITHUB_REPOSITORY");
const serverUrl = requiredEnv("GITHUB_SERVER_URL");

const runPrefix = `${new Date().toISOString().slice(0, 10)}-${runId}`;
const rawDir = path.join(STAGING_DIR, "raw", runPrefix);

const resultFiles = findResults();
if (resultFiles.length === 0) {
  console.error("No .lint-results.json files found; did lint:strict run with CI set?");
  process.exit(1);
}

mkdirSync(rawDir, { recursive: true });

const projectNames = resultFiles.map((file) => {
  const projectName = JSON.parse(readFileSync(path.join(file, "..", "package.json"), "utf8")).name;
  // Project names contain slashes ("@vortex/main"); keep them nested so the
  // staged tree matches the S3 keys raw/<runPrefix>/<projectName>.json.
  const dest = path.join(rawDir, `${projectName}.json`);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  return projectName;
});

const index = {
  date: new Date().toISOString(),
  sha,
  runURL: `${serverUrl}/${repository}/actions/runs/${runId}`,
  projectNames: projectNames.sort(),
};

writeFileSync(path.join(STAGING_DIR, `${runPrefix}.json`), JSON.stringify(index, null, 2), "utf8");

console.log(`Staged ${projectNames.length} projects under ${path.relative(ROOT, STAGING_DIR)}/`);
