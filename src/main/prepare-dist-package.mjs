import { createWriteStream, existsSync } from "node:fs";
import { glob, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAIN_DIR = resolve(import.meta.dirname);
const ROOT_DIR = resolve(MAIN_DIR, "..", "..", "..");
const MAIN_PACKAGE_PATH = resolve(MAIN_DIR, "package.json");
const DIST_DIR = resolve(MAIN_DIR, "build");
const DIST_PACKAGE_PATH = resolve(DIST_DIR, "package.json");
const NODE_MODULES_DIR = resolve(MAIN_DIR, "node_modules");
const WORKSPACE_YAML_PATH = resolve(MAIN_DIR, "pnpm-workspace.yaml");
const ROOT_WORKSPACE_YAML_PATH = resolve(ROOT_DIR, "pnpm-workspace.yaml");

// Build a map of workspace-package-name → absolute source directory, by reading the
// root pnpm-workspace.yaml's `packages:` field and globbing it. Used to translate
// `workspace:*` deps into `file:<absolute-path>` pointing at the workspace source —
// NOT at the pnpm-deploy'd copy under .pnpm/, which is about to be wiped.
async function buildWorkspacePackageMap() {
  const yaml = await readFile(ROOT_WORKSPACE_YAML_PATH, "utf8");
  const block = yaml.match(/^packages:[ \t]*\n((?:[ \t]+-\s.+\n?)+)/m);
  if (!block) return {};

  const patterns = block[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) =>
      l
        .slice(2)
        .trim()
        .replace(/^['"]|['"]$/g, ""),
    );

  const resolved = new Set();
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      for await (const m of glob(pattern, { cwd: ROOT_DIR })) resolved.add(m);
    } else {
      resolved.add(pattern);
    }
  }

  const map = {};
  for (const relPath of resolved) {
    const pkgDir = resolve(ROOT_DIR, relPath);
    try {
      const pkg = JSON.parse(await readFile(resolve(pkgDir, "package.json"), "utf8"));
      if (pkg.name) map[pkg.name] = pkgDir;
    } catch {
      // skip dirs without a readable package.json
    }
  }
  return map;
}

// Parse the `catalog:` block from pnpm-workspace.yaml into { pkgName: spec }. Specs
// include git URLs (e.g. `git+https://github.com/...#<sha>`), not just semver ranges
// — those must be preserved verbatim so the upcoming `pnpm install` can fetch them.
function parseCatalog(yamlText) {
  const match = yamlText.match(/^catalog:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!match) return {};
  const catalog = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed
      .slice(0, colon)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    const value = trimmed
      .slice(colon + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && value) catalog[key] = value;
  }
  return catalog;
}

// Resolve `catalog:` → the raw catalog spec (preserves git URLs!) and
// `workspace:*` → `file:<absolute-path>` (the workspace source dir from `wsMap`).
// Used so the re-install below has a self-contained package.json with no pnpm-specific
// protocols, which lets it run with a shadowed (non-strict) pnpm-workspace.yaml.
async function resolveDepVersions(deps, catalog, wsMap) {
  if (!deps) return deps;
  const resolved = { ...deps };
  for (const [name, version] of Object.entries(deps)) {
    if (version === "catalog:" && catalog[name]) {
      resolved[name] = catalog[name];
    } else if (version.startsWith("workspace:") && wsMap[name]) {
      resolved[name] = `file:${wsMap[name]}`;
    }
  }
  return resolved;
}

// Extract `^<name>:` block (and its indented body) from a YAML file. Returns null if
// the block isn't present. Tolerates blank lines inside the block (root yaml has them
// for visual grouping); stops only at the next top-level (non-indented) key.
function extractYamlBlock(yamlText, blockName) {
  const re = new RegExp(`^${blockName}:[ \\t]*\\n((?:[ \\t]+\\S.*\\n?|\\s*\\n)*)`, "m");
  const match = yamlText.match(re);
  return match ? match[0].trimEnd() : null;
}

// Shadow the root pnpm-workspace.yaml. The root config has `catalogMode: strict` and
// `forceLegacyDeploy: true`, which both interfere with re-installing inside the deploy
// dir. The shadow keeps just the blocks that affect resolution/native-build outcomes.
async function writeShadowWorkspaceYaml() {
  const rootYaml = await readFile(ROOT_WORKSPACE_YAML_PATH, "utf8");
  const parts = [];
  // No `packages:` key — pnpm treats this as a single-package project (the dist itself).
  // Carry over `overrides` and `allowBuilds` so transitive resolution and native-module
  // build scripts behave the same as in the workspace.
  for (const block of ["overrides", "allowBuilds"]) {
    const text = extractYamlBlock(rootYaml, block);
    if (text) parts.push(text);
  }
  await writeFile(WORKSPACE_YAML_PATH, parts.join("\n\n") + "\n");
}

async function downloadFile(url, dest) {
  await mkdir(resolve(dest, ".."), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function prepareWin() {
  const tempDir = resolve(MAIN_DIR, "temp");
  await downloadFile(
    "https://aka.ms/vs/17/release/vc_redist.x64.exe",
    resolve(tempDir, "VC_redist.x64.exe"),
  );
  await downloadFile(
    "https://aka.ms/dotnet/9.0/windowsdesktop-runtime-win-x64.exe",
    resolve(tempDir, "windowsdesktop-runtime-win-x64.exe"),
  );
}

async function main() {
  // Read the original src/main/package.json (with `catalog:` / `workspace:*` protocols
  // intact). pnpm deploy already wrote dist/package.json with its own resolution, which
  // turns git-URL catalog entries into raw versions that don't exist on npm — useless
  // for the upcoming `pnpm install`. We resolve from source instead.
  const mainPkg = JSON.parse(
    await readFile(resolve(ROOT_DIR, "src", "main", "package.json"), "utf8"),
  );

  mainPkg.name = "Vortex";
  mainPkg.main = mainPkg.main.replace(/^build\//, "");
  mainPkg.version = process.env.VORTEX_VERSION || "1.0.0";

  const rootYaml = await readFile(ROOT_WORKSPACE_YAML_PATH, "utf8");
  const catalog = parseCatalog(rootYaml);
  const wsMap = await buildWorkspacePackageMap();
  mainPkg.dependencies = await resolveDepVersions(mainPkg.dependencies, catalog, wsMap);
  mainPkg.devDependencies = await resolveDepVersions(mainPkg.devDependencies, catalog, wsMap);

  const serialized = JSON.stringify(mainPkg, null, 2) + "\n";
  await mkdir(DIST_DIR, { recursive: true });
  // Write to dist/package.json so the upcoming `pnpm install` sees resolved specs, and
  // to dist/build/package.json so electron-builder reads the same thing.
  await writeFile(MAIN_PACKAGE_PATH, serialized);
  await writeFile(DIST_PACKAGE_PATH, serialized);

  await writeShadowWorkspaceYaml();

  // pnpm deploy produced an isolated layout that electron-builder 24.x can't traverse.
  // Wipe it so the follow-up `pnpm install --node-linker=hoisted` rebuilds with the
  // proper hoist+nest layout that electron-builder understands.
  if (existsSync(NODE_MODULES_DIR)) {
    await rm(NODE_MODULES_DIR, { recursive: true, force: true });
  }

  if (process.platform === "win32") {
    await prepareWin();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
