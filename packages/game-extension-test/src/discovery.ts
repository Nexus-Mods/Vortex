import * as fs from "node:fs";
import * as path from "node:path";

/**
 * An opted-in extension on disk.
 */
export interface IDiscoveredExtension {
  packageJsonPath: string;
  packageDir: string;
  packageName: string;
}

/**
 * Walk `extensions/games/*` and return the ones whose package.json declares
 * `vortex.gameExtensionTest === true`.
 */
export function discoverExtensions(repoRoot: string): IDiscoveredExtension[] {
  const gamesDir = path.join(repoRoot, "extensions", "games");
  if (!fs.existsSync(gamesDir)) return [];
  const out: IDiscoveredExtension[] = [];
  for (const entry of fs.readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(gamesDir, entry.name, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    let pkg: any;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    if (pkg?.vortex?.gameExtensionTest === true) {
      out.push({
        packageJsonPath: pkgPath,
        packageDir: path.dirname(pkgPath),
        packageName: pkg.name,
      });
    }
  }
  return out;
}
