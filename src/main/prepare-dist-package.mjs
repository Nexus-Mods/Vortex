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

/** Parse catalog from pnpm-workspace.yaml
 * @param {string} yamlText
 * @returns {Record<string, string>}
 */
function parseCatalog(yamlText) {
  const match = yamlText.match(/^catalog:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!match) return {};

  const catalog = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    let key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    } else if (key.startsWith("'") && key.endsWith("'")) {
      key = key.slice(1, -1);
    }

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      catalog[key] = value;
    }
  }

  return catalog;
}

/** Rewrite relative file dependencies to absolute file dependencies,
 *  and resolve workspace: dependencies to absolute file dependencies */
function rewriteFileDependencies(
  deps = {},
  workspacePackageMap = {},
  catalog = {},
) {
  const rewritten = {};

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== "string") {
      rewritten[name] = version;
      continue;
    }

    if (version.startsWith("catalog:")) {
      const catalogName = version.slice("catalog:".length);
      const resolvedName = catalogName || name;
      const catalogVersion = catalog[resolvedName];
      if (catalogVersion) {
        rewritten[name] = catalogVersion;
      } else {
        rewritten[name] = version;
      }
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
async function createMinimalPackageJson(workspacePackageMap, catalog) {
  const mainRawJSON = await readFile(MAIN_PACKAGE_PATH, "utf8");
  const mainPkg = JSON.parse(mainRawJSON);

  const rootRawJSON = await readFile(ROOT_PACKAGE_PATH, "utf8");
  const rootPkg = JSON.parse(rootRawJSON);

  const minimal = {
    name: "Vortex",
    version: process.env.VORTEX_VERSION || "1.0.0",
    main: mainPkg.main.replace(/^out\//, ""),
    author: "Black Tree Gaming Ltd.",
    description:
      "The elegant, powerful, and open-source mod manager from Nexus Mods",
    homepage: "https://www.nexusmods.com/site/mods/1",
    license: "GPL-3.0",
    type: mainPkg.type,
    packageManager: rootPkg.packageManager,
    engines: rootPkg.engines,
    volta: rootPkg.volta,
  };

  if (mainPkg.dependencies && Object.keys(mainPkg.dependencies).length > 0) {
    minimal.dependencies = rewriteFileDependencies(
      mainPkg.dependencies,
      workspacePackageMap,
      catalog,
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
 * Extracts the raw "overrides:" block from a pnpm-workspace.yaml file
 * @param {string} yamlText
 * @returns {string | null}
 */
function extractOverridesBlock(yamlText) {
  const match = yamlText.match(/^overrides:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!match) return null;
  return "overrides:\n" + match[1];
}

/**
 * Extracts the raw "catalog:" block from a pnpm-workspace.yaml file
 * @param {string} yamlText
 * @returns {string | null}
 */
function extractCatalogBlock(yamlText) {
  const match = yamlText.match(/^catalog:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!match) return null;
  return "catalog:\n" + match[1];
}

/**
 * Extracts "allowBuilds" from a pnpm-workspace.yaml file
 * @param {string} yamlText  */
function extractAllowBuildsBlock(yamlText) {
  const match = yamlText.match(/^allowBuilds:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!match) return null;
  return "allowBuilds:\n" + match[1];
}

/** Prepares all PNPM related files */
async function preparePNPM(rawWorkspaceYaml) {
  const npmrc = ["node-linker=hoisted", "shamefully-hoist=true"].join("\n");
  await writeFile(resolve(DIST_DIR, ".npmrc"), npmrc);
  console.log("✔  Created dist/.npmrc");

  const allowBuilds = extractAllowBuildsBlock(rawWorkspaceYaml);
  const catalog = extractCatalogBlock(rawWorkspaceYaml);
  const overrides = extractOverridesBlock(rawWorkspaceYaml);

  const minimalYaml =
    (overrides ? overrides + "\n" : "") +
    catalog +
    "\n" +
    allowBuilds +
    "\n";

  await writeFile(resolve(DIST_DIR, "pnpm-workspace.yaml"), minimalYaml);
  console.log("✔  Created dist/pnpm-workspace.yaml");
}

async function main() {
  const rawWorkspaceYaml = await readFile(PNPM_WORKSPACE_PATH, "utf8");
  const packageGlobs = extractWorkspacePackageGlobs(rawWorkspaceYaml);
  const workspacePackageMap = await buildWorkspacePackageMap(packageGlobs);
  const catalog = parseCatalog(rawWorkspaceYaml);

  await createMinimalPackageJson(workspacePackageMap, catalog);
  await preparePNPM(rawWorkspaceYaml);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
