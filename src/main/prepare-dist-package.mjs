import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAIN_DIR = resolve(import.meta.dirname);
const MAIN_PACKAGE_PATH = resolve(MAIN_DIR, "package.json");
const DIST_DIR = resolve(MAIN_DIR, "build");
const DIST_PACKAGE_PATH = resolve(DIST_DIR, "package.json");

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
  const json = await readFile(MAIN_PACKAGE_PATH, "utf8");
  const mainPkg = JSON.parse(json);

  mainPkg["name"] = "Vortex";
  mainPkg["main"] = mainPkg.main.replace(/^build\//, "");
  mainPkg["version"] = process.env.VORTEX_VERSION || "1.0.0";

  // NOTE(erri120): this is the minimal amount of bullshit required to get the piece of shit software called "electron-builder" to work with PNPM.
  const nodeModulesDir = resolve(MAIN_DIR, "node_modules");
  mainPkg.dependencies = await resolveDepVersions(mainPkg.dependencies, nodeModulesDir);
  mainPkg.devDependencies = await resolveDepVersions(mainPkg.devDependencies, nodeModulesDir);

  await writeFile(DIST_PACKAGE_PATH, JSON.stringify(mainPkg, null, 2) + "\n", "utf8");

  if (process.platform === "win32") {
    await prepareWin();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
