/**
 * Second-stage filter for the Package workflow.
 *
 * GitHub Actions paths filters are file-level only. Without this script,
 * dependency-only edits in pnpm-workspace.yaml, package.json, or
 * src/main/package.json would run the full Windows packaging job.
 *
 * Keep Package CI focused on behavior only it validates:
 *
 * - pnpm deploy/security settings
 * - package runtime/scripts
 * - package/publish targets
 * - electron-builder config
 *
 * Main CI owns normal dependency, install, build, and test failures.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const alwaysRun = new Set([
  ".github/workflows/package.yml",
  ".github/scripts/package-ci-filter.mjs",
  "src/main/electron-builder.config.json",
]);

/**
 * Escapes a string for safe inclusion in a GitHub Actions workflow command.
 *
 * GitHub workflow commands use %, CR, and LF as control characters. Escaping
 * them keeps multi-line error details in one annotation instead of breaking the
 * command syntax.
 *
 * @param {string} value - Annotation text to escape.
 * @returns {string} Text with GitHub workflow command control characters escaped.
 */
function escapeGitHubAnnotation(value) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

// Known pnpm v11 root keys that affect deploy-time resolution/security.
const pnpmKeys = [
  "minimumReleaseAge",
  "minimumReleaseAgeExclude",
  "minimumReleaseAgeIgnoreMissingTime",
  "minimumReleaseAgeStrict",
  "registrySupportsTimeField",
  "trustPolicy",
  "trustPolicyExclude",
  "trustPolicyIgnoreAfter",
  "forceLegacyDeploy",
  "deployAllFiles",
  "injectWorkspacePackages",
  "nodeLinker",
  "resolutionMode",
  "sharedWorkspaceLockfile",
];

// Root package.json fields used by Package workflow setup/scripts.
const rootPackagePaths = [
  ["packageManager"],
  ["engines", "node"],
  ["devEngines", "runtime", "version"],
  ["scripts", "package"],
  ["scripts", "package:nosign"],
];

// src/main/package.json fields that directly shape package/deploy output.
const mainPackagePaths = [
  ["name"],
  ["productName"],
  ["main"],
  ["files"],
  ["build"],
  ["scripts", "postinstall"],
  ["scripts", "publish"],
  ["scripts", "package"],
  ["scripts", "package:nosign"],
  ["nx", "targets", "publish"],
  ["nx", "targets", "package"],
  ["nx", "targets", "package:nosign"],
];

/**
 * Runs a git command and returns stdout without its trailing newline.
 *
 * @param {string[]} args - Arguments passed to the `git` executable.
 * @returns {string} Standard output from git with trailing line endings removed.
 * @throws {Error} When the git command fails or the git executable is not found.
 */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

/**
 * Reads a repository file from HEAD or from the pull request base commit.
 *
 * @param {string} ref - Git ref to read from, or `HEAD` to read the working tree file.
 * @param {string} path - Repository-relative file path to read.
 * @returns {string} File contents, or an empty string when the file does not exist at the ref.
 */
function fileAt(ref, path) {
  if (ref === "HEAD") {
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }

  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
  } catch {
    return "";
  }
}

/**
 * Splits root-level YAML sections without pulling in extra dependencies.
 *
 * @param {string} text - YAML document text to split.
 * @returns {Map<string, string[]>} Root key names mapped to their section lines.
 */
function yamlSections(text) {
  const sections = new Map();
  let current;

  for (const line of text.split(/\r?\n/)) {
    // Match only root-level keys so nested YAML changes stay with their parent section.
    const match = /^(?!\s)([A-Za-z][^:#]*):/.exec(line);
    if (match) {
      current = match[1].trim();
      sections.set(current, []);
    }
    if (current) sections.get(current).push(line);
  }

  return sections;
}

/**
 * Finds watched YAML root keys whose section content changed.
 *
 * @param {string} path - Repository-relative YAML file path to compare.
 * @param {string[]} keys - Root YAML keys to inspect for changes.
 * @param {string} base - Pull request base git ref to compare against HEAD.
 * @returns {string[]} Watched root keys with changed section content.
 */
function changedYamlKeys(path, keys, base) {
  const before = yamlSections(fileAt(base, path));
  const after = yamlSections(fileAt("HEAD", path));

  return keys.filter(
    (key) => (before.get(key) ?? []).join("\n") !== (after.get(key) ?? []).join("\n"),
  );
}

/**
 * Reads and parses JSON from HEAD or the pull request base commit.
 *
 * @param {string} ref - Git ref to read from, or `HEAD` to read the working tree file.
 * @param {string} path - Repository-relative JSON file path to parse.
 * @returns {Record<string, unknown>} Parsed JSON object, or an empty object for missing files.
 * @throws {SyntaxError} When the file contents are not valid JSON.
 */
function jsonAt(ref, path) {
  const text = fileAt(ref, path);
  return text ? JSON.parse(text) : {};
}

/**
 * Safely reads a nested object path.
 *
 * @param {Record<string, unknown>} obj - Object to traverse.
 * @param {string[]} path - Nested property names to follow.
 * @returns {unknown} Value at the path, or undefined when any segment is missing.
 */
function get(obj, path) {
  return path.reduce((value, key) => value?.[key], obj);
}

/**
 * Finds watched JSON paths whose values changed.
 *
 * @param {string} path - Repository-relative JSON file path to compare.
 * @param {string[][]} paths - Nested JSON property paths to inspect for changes.
 * @param {string} base - Pull request base git ref to compare against HEAD.
 * @returns {string[]} Dot-separated JSON paths whose values changed.
 * @throws {SyntaxError} When either JSON file contains invalid JSON.
 */
function changedJsonPaths(path, paths, base) {
  const before = jsonAt(base, path);
  const after = jsonAt("HEAD", path);

  return paths
    .map((jsonPath) => [
      jsonPath,
      JSON.stringify(get(before, jsonPath)) !== JSON.stringify(get(after, jsonPath)),
    ])
    .filter(([, changed]) => changed)
    .map(([jsonPath]) => jsonPath.join("."));
}

/**
 * Writes the package filter result for the workflow output and logs.
 *
 * @param {boolean} runPackage - Whether the Package workflow should run.
 * @returns {void}
 * @throws {Error} When the GitHub output file is unavailable or cannot be written.
 */
function output(runPackage) {
  appendFileSync(process.env.GITHUB_OUTPUT, `run_package=${runPackage}\n`);
  console.log(`run_package=${runPackage}`);
}

// Step 0: Validate mirrored paths - fail before filtering if package/build paths drift.
const missingAlwaysRunFiles = [...alwaysRun].filter((file) => !existsSync(file));
if (missingAlwaysRunFiles.length > 0) {
  const message = [
    "alwaysRun path(s) missing:",
    ...missingAlwaysRunFiles.map((file) => `- ${file}`),
    "",
    "Fix: restore missing file(s). If you changed package/build paths, update .github/scripts/package-ci-filter.mjs and .github/workflows/package.yml together.",
  ].join("\n");

  console.error(`::error title=Package CI config error::${escapeGitHubAnnotation(message)}`);
  process.exit(1);
}

// Step 1: Filter pull requests only - other events always run.
if (process.env.EVENT_NAME !== "pull_request") {
  output(true);
  process.exit(0);
}

// Step 2: List changed files - compare base to HEAD.
const base = process.env.BASE_SHA;
const changedFiles = git(["diff", "--name-only", base, "HEAD"]).split("\n").filter(Boolean);

// Step 3: Always run - workflow or build entrypoints changed.
for (const file of changedFiles) {
  if (alwaysRun.has(file)) {
    console.log(`Package CI required by ${file}`);
    output(true);
    process.exit(0);
  }
}

// Step 4: Run - pnpm workspace settings changed.
const changedPnpmKeys = changedFiles.includes("pnpm-workspace.yaml")
  ? changedYamlKeys("pnpm-workspace.yaml", pnpmKeys, base)
  : [];
if (changedPnpmKeys.length > 0) {
  console.log(`Package CI required by pnpm-workspace.yaml: ${changedPnpmKeys.join(", ")}`);
  output(true);
  process.exit(0);
}

// Step 5: Run - root package.json inputs changed.
const changedRootPackagePaths = changedFiles.includes("package.json")
  ? changedJsonPaths("package.json", rootPackagePaths, base)
  : [];
if (changedRootPackagePaths.length > 0) {
  console.log(`Package CI required by package.json: ${changedRootPackagePaths.join(", ")}`);
  output(true);
  process.exit(0);
}

// Step 6: Run - main package.json metadata or targets changed.
const changedMainPackagePaths = changedFiles.includes("src/main/package.json")
  ? changedJsonPaths("src/main/package.json", mainPackagePaths, base)
  : [];
if (changedMainPackagePaths.length > 0) {
  console.log(
    `Package CI required by src/main/package.json: ${changedMainPackagePaths.join(", ")}`,
  );
  output(true);
  process.exit(0);
}

output(false);
