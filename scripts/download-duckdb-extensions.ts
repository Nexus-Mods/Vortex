import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtensionConfig {
  platforms: string[];
  outputDir: string;
  extensions: ExtensionEntry[];
}

interface ExtensionEntry {
  name: string;
  type: "http" | "community";
  repository?: string;
}

interface BuildUrlOptions {
  type: "http" | "community";
  name: string;
  version: string;
  platform: string;
  repository?: string;
}

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parses a @duckdb/node-api version string (e.g. "1.5.1-r.1") into the
 * DuckDB core version string (e.g. "v1.5.1") used in extension download URLs.
 */
export function parseDuckDBVersion(rawVersion: string): string {
  const match = rawVersion.match(/^(\d+\.\d+\.\d+)-r\.\d+$/);
  if (match === null) {
    throw new Error(
      `Unexpected @duckdb/node-api version format: "${rawVersion}". ` +
        `Expected pattern: "<major>.<minor>.<patch>-r.<n>"`
    );
  }
  return `v${match[1]}`;
}

/**
 * Constructs the download URL for a single extension/platform combination.
 */
export function buildExtensionUrl(opts: BuildUrlOptions): string {
  const { type, name, version, platform, repository } = opts;

  if (type === "community") {
    return `https://community-extensions.duckdb.org/v1/${version}/${platform}/${name}.duckdb_extension.gz`;
  }

  if (type === "http") {
    if (!repository) {
      throw new Error(
        `Extension "${name}" has type "http" but is missing a "repository" field.`
      );
    }
    return `${repository}/${version}/${platform}/${name}.duckdb_extension.gz`;
  }

  throw new Error(`Unknown extension type: "${type as string}"`);
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(destPath);

    const request = (url: string) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          file.destroy();
          fs.unlinkSync(destPath);
          request(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          file.destroy();
          fs.unlinkSync(destPath);
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
          return;
        }
        const gunzip = zlib.createGunzip();
        res.pipe(gunzip).pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        gunzip.on("error", (err) => {
          file.destroy();
          fs.unlinkSync(destPath);
          reject(err);
        });
        file.on("error", (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      }).on("error", reject);
    };

    request(url);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const configPath = path.resolve(__dirname, "duckdb-extensions.json");
  const config: ExtensionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Detect DuckDB version from the installed @duckdb/node-api package
  const nodeApiPkgPath = path.resolve(
    __dirname,
    "../src/main/node_modules/@duckdb/node-api/package.json"
  );
  const nodeApiPkg = JSON.parse(fs.readFileSync(nodeApiPkgPath, "utf8"));
  const duckdbVersion = parseDuckDBVersion(nodeApiPkg.version as string);

  console.log(`DuckDB version: ${duckdbVersion}`);

  const outputDir = path.resolve(__dirname, "..", config.outputDir);

  for (const ext of config.extensions) {
    for (const platform of config.platforms) {
      const url = buildExtensionUrl({
        type: ext.type,
        name: ext.name,
        version: duckdbVersion,
        platform,
        repository: ext.repository,
      });

      const destPath = path.join(
        outputDir,
        duckdbVersion,
        platform,
        `${ext.name}.duckdb_extension`
      );

      if (fs.existsSync(destPath)) {
        console.log(`  skip  ${ext.name} [${platform}] — already exists`);
        continue;
      }

      console.log(`  download  ${ext.name} [${platform}]`);
      console.log(`    from: ${url}`);
      console.log(`    to:   ${destPath}`);
      await downloadFile(url, destPath);
      console.log(`  ✓ ${ext.name} [${platform}]`);
    }
  }

  console.log("Done.");
}

// Only run when executed directly (not when imported for testing)
const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
