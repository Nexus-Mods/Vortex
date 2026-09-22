import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAIN_DIR = resolve(import.meta.dirname);
const MAIN_PACKAGE_PATH = resolve(MAIN_DIR, "package.json");
const DIST_DIR = resolve(MAIN_DIR, "build");
const DIST_PACKAGE_PATH = resolve(DIST_DIR, "package.json");
const WORKSPACE_PATH = resolve(MAIN_DIR, "pnpm-workspace.yaml");
// Runtimes bundled into the installer; also declared as winget dependencies by winget-release.yml.
const RUNTIME_DEPS_FILE = "runtime-dependencies.json";

// Walks up because MAIN_DIR is the pnpm-deployed copy (src/main/dist), not src/main.
function findUp(fileName, from) {
  let dir = from;
  for (;;) {
    const candidate = resolve(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find ${fileName} above ${from}`);
    dir = parent;
  }
}

async function resolveDepVersions(deps, nodeModulesDir) {
  if (!deps) return deps;
  const resolved = { ...deps };
  for (const [name, version] of Object.entries(deps)) {
    if (version === "catalog:" || version.startsWith("workspace:")) {
      try {
        const pkgJson = JSON.parse(
          await readFile(resolve(nodeModulesDir, name, "package.json"), "utf8"),
        );
        resolved[name] = pkgJson.version;
      } catch {
        // leave as-is if not found in node_modules
      }
    }
  }
  return resolved;
}

// pnpm's pre-run deps check (verifyDepsBeforeRun) would try to install into the
// deployed copy on any bare `pnpm` call here, and nothing can install there: deploy
// writes a lockfile with catalogs but a workspace file without them. Only the deployed
// copy has that file, so this is a no-op when the script is run from src/main.
async function disableDepsCheck() {
  const existing = await readFile(WORKSPACE_PATH, "utf8").catch(() => null);
  if (existing === null || existing.includes("verifyDepsBeforeRun")) return;
  await writeFile(WORKSPACE_PATH, `${existing.trimEnd()}\nverifyDepsBeforeRun: false\n`, "utf8");
}

async function downloadFile(url, dest) {
  await mkdir(resolve(dest, ".."), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function prepareWin() {
  const tempDir = resolve(MAIN_DIR, "temp");
  const runtimeDeps = JSON.parse(await readFile(findUp(RUNTIME_DEPS_FILE, MAIN_DIR), "utf8"));
  for (const { file, url } of runtimeDeps) {
    await downloadFile(url, resolve(tempDir, file));
  }
}

async function main() {
  const json = await readFile(MAIN_PACKAGE_PATH, "utf8");
  const mainPkg = JSON.parse(json);

  mainPkg["name"] = "Vortex";
  mainPkg["main"] = mainPkg.main.replace(/^build\//, "");

  // NOTE(erri120): this is the minimal amount of bullshit required to get the piece of shit software called "electron-builder" to work with PNPM.
  const nodeModulesDir = resolve(MAIN_DIR, "node_modules");
  mainPkg.dependencies = await resolveDepVersions(mainPkg.dependencies, nodeModulesDir);
  mainPkg.devDependencies = await resolveDepVersions(mainPkg.devDependencies, nodeModulesDir);

  await writeFile(DIST_PACKAGE_PATH, JSON.stringify(mainPkg, null, 2) + "\n", "utf8");

  await disableDepsCheck();

  if (process.platform === "win32") {
    await prepareWin();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
