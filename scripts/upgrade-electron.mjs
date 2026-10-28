/**
 * Upgrades Electron to the newest release of its current major and keeps the
 * pinned Node.js version equal to the Node.js that release bundles.
 *
 * Node.js is pinned in package.json (engines.node, engines.runtime.version,
 * devEngines.runtime.version), pnpm-workspace.yaml (the `node@runtime:<ver>`
 * allowBuilds key) and pnpm-lock.yaml. Electron is the `electron` catalog
 * entry in pnpm-workspace.yaml.
 *
 * Source of truth for Electron -> Node.js: https://releases.electronjs.org/releases.json
 *
 * The target is the newest stable Electron release of the current major that is
 * at least `minimumReleaseAge` (pnpm-workspace.yaml) old. @electron/rebuild
 * resolves the ABI through node-abi, so when the installed node-abi does not
 * know the target, node-abi is bumped to its newest release (same age rule). If
 * there is no newer node-abi, or it still does not know the target, the script
 * fails.
 *
 * Usage:
 *   node scripts/upgrade-electron.mjs [--check]
 *
 *   --check  report what would change, modify nothing
 *
 * Only package.json, pnpm-workspace.yaml and pnpm-lock.yaml are modified; the
 * script does not commit. When GITHUB_OUTPUT is set it writes: updated,
 * electron_old, electron_new, node_old, node_new, node_abi_old, node_abi_new.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const WORKSPACE_YAML = path.join(ROOT, "pnpm-workspace.yaml");
const EXPECTED_CHANGES = new Set(["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"]);

const RELEASES_URL = "https://releases.electronjs.org/releases.json";
const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

const check = process.argv.includes("--check");

/**
 * An entry of releases.electronjs.org/releases.json (only the fields used here).
 * @typedef {object} ElectronRelease
 * @property {string} version Electron version, e.g. "45.1.0"
 * @property {string} node Node.js version bundled with it
 * @property {string} date Release date, e.g. "2026-10-27"
 * @property {string} [fullDate] Release timestamp (ISO 8601)
 */

/**
 * What the repo currently pins.
 * @typedef {object} PinnedState
 * @property {string} electron Electron catalog version
 * @property {string} node Node.js version pinned in package.json
 * @property {string} nodeAbi node-abi catalog version
 * @property {number} minReleaseAgeMs `minimumReleaseAge` from pnpm-workspace.yaml, in ms
 */

/**
 * Prints the message to stderr and exits with a failure code.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

/**
 * @param {string} version "major.minor.patch"
 * @returns {number[]}
 */
function parse(version) {
  return version.split(".").map(Number);
}

/**
 * Sort comparator for "major.minor.patch" versions.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compare(a, b) {
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * @param {string} version "major.minor.patch"
 * @returns {number}
 */
function major(version) {
  return parse(version)[0];
}

/**
 * Runs a command in the repo root with inherited stdio, failing on a non-zero exit.
 * @param {string} command
 * @param {string[]} args
 * @returns {void}
 */
function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} exited with ${result.status}`);
}

/**
 * Runs a command in the repo root and returns its stdout, failing on a non-zero exit.
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function capture(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

/**
 * @param {...string} args extra `pnpm install` arguments
 * @returns {void}
 */
function pnpmInstall(...args) {
  run("pnpm", ["install", ...args]);
}

/**
 * Appends step outputs to $GITHUB_OUTPUT; a no-op outside GitHub Actions.
 * @param {Record<string, string>} values
 * @returns {void}
 */
function setOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
}

/**
 * @param {string} file
 * @returns {string}
 */
function readText(file) {
  return readFileSync(file, "utf8");
}

/**
 * Replaces every occurrence of `from`, requiring exactly `count` of them.
 * @param {string} text
 * @param {string} from
 * @param {string} to
 * @param {number} count expected number of occurrences
 * @param {string} what description used in the error message
 * @returns {string}
 */
function replaceExactly(text, from, to, count, what) {
  const parts = text.split(from);
  if (parts.length - 1 !== count) {
    fail(`expected ${count} occurrence(s) of ${what}, found ${parts.length - 1}`);
  }
  return parts.join(to);
}

/**
 * Reads the pinned versions, failing if the three package.json Node.js pins disagree.
 * @returns {PinnedState}
 */
function currentState() {
  const pkg = JSON.parse(readText(PACKAGE_JSON));
  const pins = {
    "engines.node": pkg.engines?.node,
    "engines.runtime.version": pkg.engines?.runtime?.version,
    "devEngines.runtime.version": pkg.devEngines?.runtime?.version,
  };
  const node = pins["devEngines.runtime.version"];
  for (const [field, value] of Object.entries(pins)) {
    if (value !== node) fail(`package.json ${field} is ${value}, expected ${node}`);
  }

  const workspace = readText(WORKSPACE_YAML);
  const electron = /^ {2}electron: (\d+\.\d+\.\d+)$/m.exec(workspace)?.[1];
  if (!electron) fail("could not find the electron catalog entry in pnpm-workspace.yaml");
  const nodeAbi = /^ {2}node-abi: (\d+\.\d+\.\d+)$/m.exec(workspace)?.[1];
  if (!nodeAbi) fail("could not find the node-abi catalog entry in pnpm-workspace.yaml");

  const minutes = /^minimumReleaseAge: (\d+)$/m.exec(workspace)?.[1];
  if (!minutes) fail("could not find minimumReleaseAge in pnpm-workspace.yaml");
  const minReleaseAgeMs = Number(minutes) * 60 * 1000;

  return { electron, node, nodeAbi, minReleaseAgeMs };
}

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) fail(`GET ${url} returned ${response.status}`);
  return response.json();
}

/**
 * Newest stable release of the current major that is newer than `electron` and old enough.
 * @param {ElectronRelease[]} releases
 * @param {string} electron current Electron version
 * @param {number} minReleaseAgeMs
 * @returns {ElectronRelease | undefined}
 */
function newestRelease(releases, electron, minReleaseAgeMs) {
  const now = Date.now();
  return releases
    .filter(
      (release) =>
        STABLE_VERSION.test(release.version) &&
        major(release.version) === major(electron) &&
        compare(release.version, electron) > 0 &&
        now - Date.parse(release.fullDate ?? release.date) >= minReleaseAgeMs,
    )
    .sort((a, b) => compare(a.version, b.version))
    .at(-1);
}

/**
 * Whether the installed node-abi knows this Electron version. Runs in a fresh
 * process so a node-abi bump installed mid-run is picked up.
 * @param {string} version Electron version
 * @returns {boolean}
 */
function abiKnown(version) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import { getAbi } from 'node-abi'; getAbi(process.env.ELECTRON_VERSION, 'electron');",
    ],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, ELECTRON_VERSION: version } },
  );
  return result.status === 0;
}

/**
 * Newest stable node-abi that is newer than `current` and old enough.
 * @param {string} current
 * @param {number} minReleaseAgeMs
 * @returns {Promise<string | undefined>}
 */
async function newestNodeAbi(current, minReleaseAgeMs) {
  const doc = await fetchJson(`${NPM_REGISTRY_URL}/node-abi`);
  const now = Date.now();
  return Object.keys(doc.versions)
    .filter(
      (version) =>
        STABLE_VERSION.test(version) &&
        compare(version, current) > 0 &&
        now - Date.parse(doc.time[version]) >= minReleaseAgeMs,
    )
    .sort(compare)
    .at(-1);
}

/**
 * Rewrites the `electron` catalog entry in pnpm-workspace.yaml.
 * @param {{ from: string, to: string }} electron
 * @returns {void}
 */
function updateElectron(electron) {
  let workspace = readText(WORKSPACE_YAML);
  workspace = replaceExactly(
    workspace,
    `\n  electron: ${electron.from}\n`,
    `\n  electron: ${electron.to}\n`,
    1,
    "the electron catalog entry",
  );
  writeFileSync(WORKSPACE_YAML, workspace);
}

/**
 * Rewrites the node-abi catalog and overrides entries in pnpm-workspace.yaml.
 * @param {string} from
 * @param {string} to
 * @returns {void}
 */
function updateNodeAbi(from, to) {
  // Pinned twice: the catalog entry and the overrides entry, both indented the same.
  const workspace = replaceExactly(
    readText(WORKSPACE_YAML),
    `\n  node-abi: ${from}\n`,
    `\n  node-abi: ${to}\n`,
    2,
    "the node-abi catalog and overrides entries",
  );
  writeFileSync(WORKSPACE_YAML, workspace);
}

/**
 * Rewrites the three Node.js pins in package.json.
 * @param {string} from
 * @param {string} to
 * @returns {void}
 */
function updatePackageJsonNode(from, to) {
  const text = replaceExactly(
    readText(PACKAGE_JSON),
    `"${from}"`,
    `"${to}"`,
    3,
    "the pinned node version in package.json",
  );
  writeFileSync(PACKAGE_JSON, text);
}

/**
 * Swaps the `node@runtime:` allowBuilds key, keeping the block alphabetically ordered.
 * @param {string} from
 * @param {string} to
 * @returns {void}
 */
function updateAllowBuilds(from, to) {
  const lines = readText(WORKSPACE_YAML).split("\n");
  const start = lines.findIndex((line) => line === "allowBuilds:");
  if (start < 0) fail("could not find allowBuilds in pnpm-workspace.yaml");
  let end = start + 1;
  while (end < lines.length && /^ {2}\S/.test(lines[end])) end++;

  const keyOf = (line) => line.slice(2, line.lastIndexOf(":")).replace(/^"|"$/g, "");
  const block = lines
    .slice(start + 1, end)
    .filter((line) => keyOf(line) !== `node@runtime:${from}`);
  const entry = `  node@runtime:${to}: true`;
  const at = block.findIndex((line) => keyOf(line) > `node@runtime:${to}`);
  block.splice(at < 0 ? block.length : at, 0, entry);

  lines.splice(start + 1, end - start - 1, ...block);
  writeFileSync(WORKSPACE_YAML, lines.join("\n"));
}

/**
 * Fails if anything besides package.json, pnpm-workspace.yaml and pnpm-lock.yaml changed.
 * @returns {void}
 */
function assertOnlyExpectedChanges() {
  const changed = capture("git", ["status", "--porcelain"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3));
  const unexpected = changed.filter((file) => !EXPECTED_CHANGES.has(file));
  if (unexpected.length > 0)
    fail(`unexpected changes in the working tree: ${unexpected.join(", ")}`);
}

/** @returns {Promise<void>} */
async function main() {
  const current = currentState();
  console.log(
    `current: electron ${current.electron}, node ${current.node}, node-abi ${current.nodeAbi}`,
  );

  const releases = await fetchJson(RELEASES_URL);
  const entryFor = (version) => releases.find((release) => release.version === version);
  let target = newestRelease(releases, current.electron, current.minReleaseAgeMs);

  // No newer electron: still make sure node matches the current one.
  if (!target) {
    const own = entryFor(current.electron);
    if (!own) fail(`electron ${current.electron} is not listed in ${RELEASES_URL}`);
    if (own.node === current.node) {
      console.log("up to date");
      setOutput({ updated: "false" });
      return;
    }
    target = own;
  }

  let nodeAbiTo;
  if (!abiKnown(target.version)) {
    nodeAbiTo = await newestNodeAbi(current.nodeAbi, current.minReleaseAgeMs);
    if (!nodeAbiTo) {
      fail(
        `node-abi ${current.nodeAbi} does not know electron ${target.version} and no newer node-abi is available`,
      );
    }
  }

  console.log(
    `upgrading: electron ${current.electron} -> ${target.version}, node ${current.node} -> ${target.node}` +
      (nodeAbiTo ? `, node-abi ${current.nodeAbi} -> ${nodeAbiTo}` : ""),
  );
  if (check) return;

  // Fail on a stale lockfile before changing anything.
  pnpmInstall("--frozen-lockfile");

  if (nodeAbiTo) {
    updateNodeAbi(current.nodeAbi, nodeAbiTo);
    pnpmInstall();
    if (!abiKnown(target.version)) {
      fail(`node-abi ${nodeAbiTo} does not know electron ${target.version}`);
    }
  }

  updateElectron({ from: current.electron, to: target.version });
  if (target.node !== current.node) {
    updatePackageJsonNode(current.node, target.node);
  }
  pnpmInstall();

  if (target.node !== current.node) {
    updateAllowBuilds(current.node, target.node);
    pnpmInstall();
  }

  assertOnlyExpectedChanges();
  setOutput({
    updated: "true",
    electron_old: current.electron,
    electron_new: target.version,
    node_old: current.node,
    node_new: target.node,
    node_abi_old: current.nodeAbi,
    node_abi_new: nodeAbiTo ?? current.nodeAbi,
  });
}

await main();
