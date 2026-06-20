import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as zlib from "node:zlib";

const UPDATE_DUCKDB_LOCK_ARG = "--update-duckdb-lock";
const DUCKDB_EXTENSION_SOURCE_DIR_ENV = "VORTEX_DUCKDB_EXTENSION_SOURCE_DIR";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IExtensionConfig {
  platforms: string[];
  outputDir: string;
  extensions: IExtensionEntry[];
}

export interface IExtensionLockFile {
  version: 1;
  duckdbVersion: string;
  extensions: IExtensionLockEntry[];
}

interface IExtensionEntry {
  name: string;
  type: "http" | "community";
  repository?: string;
}

interface IExtensionLockEntry {
  name: string;
  platforms: Record<string, IExtensionLockArtifact>;
}

interface IExtensionLockArtifact {
  url: string;
  sha256: string;
}

interface IBuildUrlOptions {
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
        `Expected pattern: "<major>.<minor>.<patch>-r.<n>"`,
    );
  }
  return `v${match[1]}`;
}

/**
 * Constructs the download URL for a single extension/platform combination.
 */
export function buildExtensionUrl(opts: IBuildUrlOptions): string {
  const { type, name, version, platform, repository } = opts;

  if (type === "community") {
    return `https://community-extensions.duckdb.org/v1/${version}/${platform}/${name}.duckdb_extension.gz`;
  }

  if (type === "http") {
    if (!repository) {
      throw new Error(`Extension "${name}" has type "http" but is missing a "repository" field.`);
    }
    return `${repository}/${version}/${platform}/${name}.duckdb_extension.gz`;
  }

  throw new Error(`Unknown extension type: "${type as string}"`);
}

/**
 * Ensures the generated lockfile still covers the human-editable extension
 * config for the installed DuckDB version.
 */
export function validateExtensionLock(
  config: IExtensionConfig,
  lock: IExtensionLockFile,
  duckdbVersion: string,
): void {
  if (lock.duckdbVersion !== duckdbVersion) {
    throw new Error(
      `DuckDB extension lockfile is for ${lock.duckdbVersion}, but installed ` +
        `@duckdb/node-api requires ${duckdbVersion}. Refresh the lockfile before building.`,
    );
  }

  for (const ext of config.extensions) {
    const lockedExtension = lock.extensions.find((entry) => entry.name === ext.name);
    if (lockedExtension === undefined) {
      throw new Error(`DuckDB extension lockfile is missing extension "${ext.name}".`);
    }

    for (const platform of config.platforms) {
      const artifact = lockedExtension.platforms[platform];
      if (artifact === undefined) {
        throw new Error(
          `DuckDB extension lockfile is missing ${ext.name} for platform "${platform}".`,
        );
      }
      if (artifact.url.length === 0) {
        throw new Error(
          `DuckDB extension lockfile has an empty URL for ${ext.name} [${platform}].`,
        );
      }
      if (artifact.sha256.length === 0) {
        throw new Error(
          `DuckDB extension lockfile has an empty SHA256 for ${ext.name} [${platform}].`,
        );
      }
    }
  }
}

export function getLockedExtensionArtifact(
  lock: IExtensionLockFile,
  extensionName: string,
  platform: string,
): IExtensionLockArtifact {
  const lockedExtension = lock.extensions.find((entry) => entry.name === extensionName);
  const artifact = lockedExtension?.platforms[platform];
  if (artifact === undefined) {
    throw new Error(
      `DuckDB extension lockfile is missing ${extensionName} for platform "${platform}".`,
    );
  }
  return artifact;
}

export function assertSha256Matches(
  expectedSha256: string,
  actualSha256: string,
  label: string,
): void {
  if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(
      `SHA256 mismatch for ${label}: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
}

export function getLocalExtensionArtifactPath(
  duckdbExtensionSourceDir: string,
  duckdbVersion: string,
  platform: string,
  extensionName: string,
): string {
  return path.join(
    duckdbExtensionSourceDir,
    duckdbVersion,
    platform,
    `${extensionName}.duckdb_extension.gz`,
  );
}

async function createExtensionLockFile(
  config: IExtensionConfig,
  duckdbVersion: string,
): Promise<IExtensionLockFile> {
  const extensions: IExtensionLockEntry[] = [];

  for (const ext of config.extensions) {
    const platforms: Record<string, IExtensionLockArtifact> = {};

    for (const platform of config.platforms) {
      // Lock refresh is the only flow that resolves config URLs into bytes.
      const url = buildExtensionUrl({
        type: ext.type,
        name: ext.name,
        version: duckdbVersion,
        platform,
        repository: ext.repository,
      });

      platforms[platform] = await hashRemoteArtifact(ext, platform, url);
    }

    extensions.push({
      name: ext.name,
      platforms,
    });
  }

  return {
    version: 1,
    duckdbVersion,
    extensions,
  };
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function unlinkIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function downloadCompressedFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });

    const request = (url: string) => {
      const file = fs.createWriteStream(destPath);

      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.destroy();
            unlinkIfExists(destPath);
            if (res.headers.location === undefined) {
              reject(new Error(`Redirect without location downloading ${url}`));
              return;
            }
            request(new URL(res.headers.location, url).href);
            return;
          }
          if (res.statusCode !== 200) {
            file.destroy();
            unlinkIfExists(destPath);
            reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
          file.on("error", (err) => {
            unlinkIfExists(destPath);
            reject(err);
          });
        })
        .on("error", reject);
    };

    request(url);
  });
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const file = fs.createReadStream(filePath);

    file.on("data", (chunk) => hash.update(chunk));
    file.on("end", () => resolve(hash.digest("hex")));
    file.on("error", reject);
  });
}

function gunzipFile(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(sourcePath);
    const gunzip = zlib.createGunzip();
    const dest = fs.createWriteStream(destPath);

    source.pipe(gunzip).pipe(dest);

    dest.on("finish", () => {
      dest.close();
      resolve();
    });
    source.on("error", reject);
    gunzip.on("error", (err) => {
      dest.destroy();
      unlinkIfExists(destPath);
      reject(err);
    });
    dest.on("error", (err) => {
      unlinkIfExists(destPath);
      reject(err);
    });
  });
}

async function downloadFile(
  url: string,
  expectedSha256: string,
  unpackedDuckDBExtensionPath: string,
): Promise<void> {
  const compressedDuckDBExtensionPath = `${unpackedDuckDBExtensionPath}.gz`;
  try {
    // Verify the compressed artifact, because that is what the lockfile pins.
    await downloadCompressedFile(url, compressedDuckDBExtensionPath);
    await verifyAndGunzipFile(
      compressedDuckDBExtensionPath,
      expectedSha256,
      url,
      unpackedDuckDBExtensionPath,
    );
  } finally {
    unlinkIfExists(compressedDuckDBExtensionPath);
  }
}

async function installLocalFile(
  prefetchedDuckDBExtensionPath: string,
  expectedSha256: string,
  unpackedDuckDBExtensionPath: string,
): Promise<void> {
  if (!fs.existsSync(prefetchedDuckDBExtensionPath)) {
    throw new Error(
      `Prefetched DuckDB extension artifact not found: ${prefetchedDuckDBExtensionPath}`,
    );
  }

  // Flatpak prefetches the same locked .gz into the offline build sandbox.
  await verifyAndGunzipFile(
    prefetchedDuckDBExtensionPath,
    expectedSha256,
    prefetchedDuckDBExtensionPath,
    unpackedDuckDBExtensionPath,
  );
}

async function verifyAndGunzipFile(
  compressedDuckDBExtensionPath: string,
  expectedSha256: string,
  label: string,
  unpackedDuckDBExtensionPath: string,
): Promise<void> {
  const actualSha256 = await sha256File(compressedDuckDBExtensionPath);
  assertSha256Matches(expectedSha256, actualSha256, label);
  await gunzipFile(compressedDuckDBExtensionPath, unpackedDuckDBExtensionPath);
}

async function hashRemoteArtifact(
  extension: IExtensionEntry,
  platform: string,
  url: string,
): Promise<IExtensionLockArtifact> {
  const duckdbExtensionTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "duckdb-extension-lock-"));
  const compressedDuckDBExtensionPath = path.join(
    duckdbExtensionTempDir,
    `${extension.name}-${platform}.duckdb_extension.gz`,
  );

  try {
    console.log(`  resolve  ${extension.name} [${platform}]`);
    console.log(`    from: ${url}`);
    await downloadCompressedFile(url, compressedDuckDBExtensionPath);
    return {
      url,
      sha256: await sha256File(compressedDuckDBExtensionPath),
    };
  } finally {
    unlinkIfExists(compressedDuckDBExtensionPath);
    fs.rmSync(duckdbExtensionTempDir, { force: true, recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const updateDuckDBLock = process.argv.includes(UPDATE_DUCKDB_LOCK_ARG);
  const duckdbExtensionsConfigPath = path.resolve(import.meta.dirname, "duckdb-extensions.json");
  const duckdbExtensionsConfig: IExtensionConfig = JSON.parse(
    fs.readFileSync(duckdbExtensionsConfigPath, "utf8"),
  );
  const duckdbExtensionsLockPath = path.resolve(import.meta.dirname, "duckdb-extensions.lock.json");

  // Detect DuckDB version from the installed @duckdb/node-api package
  const duckdbNodeApiPackagePath = path.resolve(
    import.meta.dirname,
    "node_modules/@duckdb/node-api/package.json",
  );
  const duckdbNodeApiPackage = JSON.parse(fs.readFileSync(duckdbNodeApiPackagePath, "utf8"));
  const duckdbVersion = parseDuckDBVersion(duckdbNodeApiPackage.version as string);

  console.log(`DuckDB version: ${duckdbVersion}`);

  // Update mode is explicit because it may follow mutable artifact repositories.
  if (updateDuckDBLock) {
    const duckdbExtensionsLock = await createExtensionLockFile(
      duckdbExtensionsConfig,
      duckdbVersion,
    );
    fs.writeFileSync(
      duckdbExtensionsLockPath,
      `${JSON.stringify(duckdbExtensionsLock, null, 2)}\n`,
    );
    console.log(`Updated ${duckdbExtensionsLockPath}`);
    return;
  }

  // Normal mode only consumes the generated lockfile: no URL resolution here.
  const duckdbExtensionsLock: IExtensionLockFile = JSON.parse(
    fs.readFileSync(duckdbExtensionsLockPath, "utf8"),
  );

  // Normal builds must fail early if the generated lock no longer matches intent.
  validateExtensionLock(duckdbExtensionsConfig, duckdbExtensionsLock, duckdbVersion);

  const duckdbExtensionsOutputDir = path.resolve(
    import.meta.dirname,
    duckdbExtensionsConfig.outputDir,
  );

  // Flatpak sets this to an offline source directory populated before build time.
  const duckdbExtensionSourceDir = process.env[DUCKDB_EXTENSION_SOURCE_DIR_ENV] || undefined;

  for (const ext of duckdbExtensionsConfig.extensions) {
    for (const platform of duckdbExtensionsConfig.platforms) {
      const { sha256, url } = getLockedExtensionArtifact(duckdbExtensionsLock, ext.name, platform);

      const unpackedDuckDBExtensionPath = path.join(
        duckdbExtensionsOutputDir,
        duckdbVersion,
        platform,
        `${ext.name}.duckdb_extension`,
      );

      if (fs.existsSync(unpackedDuckDBExtensionPath)) {
        console.log(`  skip  ${ext.name} [${platform}] — already exists`);
        continue;
      }

      console.log(`  download  ${ext.name} [${platform}]`);
      console.log(`    from: ${url}`);
      console.log(`    to:   ${unpackedDuckDBExtensionPath}`);
      if (duckdbExtensionSourceDir) {
        const prefetchedDuckDBExtensionPath = getLocalExtensionArtifactPath(
          duckdbExtensionSourceDir,
          duckdbVersion,
          platform,
          ext.name,
        );
        console.log(`    prefetched: ${prefetchedDuckDBExtensionPath}`);
        await installLocalFile(prefetchedDuckDBExtensionPath, sha256, unpackedDuckDBExtensionPath);
      } else {
        await downloadFile(url, sha256, unpackedDuckDBExtensionPath);
      }
      console.log(`  ✓ ${ext.name} [${platform}]`);
    }
  }

  console.log("Done.");
}

// Only run when executed directly (not when imported for testing)
const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
