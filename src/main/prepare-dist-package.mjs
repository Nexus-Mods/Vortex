import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = resolve(__dirname, "..", "..");
const ROOT_PACKAGE_PATH = resolve(ROOT_DIR, "package.json");
const PNPM_WORKSPACE_PATH = resolve(ROOT_DIR, "pnpm-workspace.yaml");

const MAIN_DIR = resolve(__dirname);
const MAIN_PACKAGE_PATH = resolve(MAIN_DIR, "package.json");
const DIST_DIR = resolve(MAIN_DIR, "dist");
const DIST_PACKAGE_PATH = resolve(DIST_DIR, "package.json");

/** Rewrite relative file dependencies to absolute file dependencies,
 *  and resolve workspace: dependencies to absolute file dependencies */
function rewriteFileDependencies(deps = {}, workspacePackageMap = {}) {
  const rewritten = {};

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== "string") {
      rewritten[name] = version;
      continue;
    }

    if (version.startsWith("workspace:")) {
      const absolutePath = workspacePackageMap[name];
      if (absolutePath) {
        rewritten[name] = `file:${absolutePath}`;
      } else {
        rewritten[name] = version;
      }
      continue;
    }

    if (!version.startsWith("file:")) {
      rewritten[name] = version;
      continue;
    }

    const rawPath = version.slice("file:".length);
    if (isAbsolute(rawPath)) {
      rewritten[name] = version;
    } else {
      const absolutePath = resolve(MAIN_DIR, rawPath);
      rewritten[name] = `file:${absolutePath}`;
    }
  }

  return rewritten;
}

/**
 * Extracts workspace package paths from a pnpm-workspace.yaml file
 * @param {string} yamlText
 * @returns {string[]}
 */
function extractWorkspacePackageGlobs(yamlText) {
  const match = yamlText.match(/^packages:\s*\n((?:\s*-\s*.+\n?)*)/m);

  if (!match) return [];
  const listBlock = match[1];

  return listBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

/**
 * Builds a map from workspace package name to absolute directory path.
 * Glob patterns containing "*" are skipped.
 * @param {string[]} packagePaths
 * @returns {Promise<Record<string, string>>}
 */
async function buildWorkspacePackageMap(packagePaths) {
  const map = {};

  for (const pkgPath of packagePaths) {
    if (pkgPath.includes("*")) continue;

    const pkgDir = resolve(ROOT_DIR, pkgPath);
    const pkgJsonPath = resolve(pkgDir, "package.json");

    try {
      const raw = await readFile(pkgJsonPath, "utf8");
      const pkg = JSON.parse(raw);
      if (pkg.name) {
        map[pkg.name] = pkgDir;
      }
    } catch {
      // Skip packages whose package.json cannot be read
    }
  }

  return map;
}

/** Creates a minimal package.json file */
async function createMinimalPackageJson(workspacePackageMap) {
  const mainRawJSON = await readFile(MAIN_PACKAGE_PATH, "utf8");
  const mainPkg = JSON.parse(mainRawJSON);

  const rootRawJSON = await readFile(ROOT_PACKAGE_PATH, "utf8");
  const rootPkg = JSON.parse(rootRawJSON);

  const minimal = {
    name: "Vortex",
    version: "2.0.0",
    main: "main.js",
    author: "Black Tree Gaming Ltd.",
    description:
      "The elegant, powerful, and open-source mod manager from Nexus Mods",
    license: "GPL-3.0",
    type: mainPkg.type,
    pnpm: rootPkg.pnpm,
    packageManager: rootPkg.packageManager,
    engines: rootPkg.engines,
    volta: rootPkg.volta,
  };

  if (mainPkg.dependencies && Object.keys(mainPkg.dependencies).length > 0) {
    minimal.dependencies = rewriteFileDependencies(
      mainPkg.dependencies,
      workspacePackageMap,
    );
  }

  await mkdir(DIST_DIR, { recursive: true });

  await writeFile(
    DIST_PACKAGE_PATH,
    JSON.stringify(minimal, null, 2) + "\n",
    "utf8",
  );

  console.log("✔  Created dist/package.json");
}

/**
 * Extracts "onlyBuiltDependencies" from a pnpm-workspace.yaml file
 * @param {string} yamlText  */
function extractOnlyBuiltDependencies(yamlText) {
  const match = yamlText.match(
    /^onlyBuiltDependencies:\s*\n((?:\s*-\s*.+\n?)*)/m,
  );

  if (!match) return null;
  const listBlock = match[1];

  const entries = listBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  if (!entries.length) return null;
  return entries;
}

/** Prepares all PNPM related files */
async function preparePNPM(rawWorkspaceYaml) {
  const npmrc = ["node-linker=hoisted", "shamefully-hoist=true"].join("\n");
  await writeFile(resolve(DIST_DIR, ".npmrc"), npmrc);
  console.log("✔  Created dist/.npmrc");

  const onlyBuiltDependencies = extractOnlyBuiltDependencies(rawWorkspaceYaml);

  const minimalYaml =
    "onlyBuiltDependencies:\n" +
    onlyBuiltDependencies.map((dep) => `  - ${dep}`).join("\n") +
    "\n";

  await writeFile(resolve(DIST_DIR, "pnpm-workspace.yaml"), minimalYaml);
  console.log("✔  Created dist/pnpm-workspace.yaml");
}

async function main() {
  const rawWorkspaceYaml = await readFile(PNPM_WORKSPACE_PATH, "utf8");
  const packageGlobs = extractWorkspacePackageGlobs(rawWorkspaceYaml);
  const workspacePackageMap = await buildWorkspacePackageMap(packageGlobs);

  await createMinimalPackageJson(workspacePackageMap);
  await preparePNPM(rawWorkspaceYaml);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
