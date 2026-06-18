/**
 * Helpers for reading and writing mock tree fixtures used by game setup tests.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Models the on-disk mock tree fixture used by game setup tests.
 */
export type MockTreeEntryType = "dir" | "file";

/**
 * Lists the supported fixture platform names.
 */
export type MockTreePlatform = "windows" | "linux" | "macos";

/**
 * Supported platform names in the order fixture generators use them.
 */
export const MOCK_TREE_PLATFORMS = [
  "windows",
  "linux",
  "macos",
] as const satisfies readonly MockTreePlatform[];

/**
 * Describes one directory or file entry in a mock tree fixture.
 */
export interface MockTreeEntry {
  /** Entry kind stored in the tree file. */
  type: MockTreeEntryType;
  /** Fixture-relative path for the entry. */
  path: string;
}

/**
 * Points to the directory that contains a mock tree fixture.
 */
export interface MockTreeFixture {
  /** Root directory that contains the fixture files. */
  rootDir: string;
}

/**
 * Holds the merged tree entries and payload search roots for a fixture.
 */
export interface ResolvedMockTreeFixture {
  /** Merged tree entries from the shared and platform-specific files. */
  entries: MockTreeEntry[];
  /** Payload directories searched for matching files. */
  filesDirs: string[];
}

interface WriteMockTreeOptions {
  filesDir?: string;
  filesDirs?: string[];
}

/**
 * Reads and merges the common and platform-specific mock tree files for a fixture.
 *
 * @param fixture Root directory that contains the fixture.
 * @param platform Mock tree platform to load. Defaults to the current Node platform.
 * @returns The merged entries and payload search roots for the fixture.
 * # Errors
 * - Throws when the fixture has neither `tree.txt` nor `tree.<platform>.txt`.
 * - Throws when the Node platform is not one of `darwin`, `linux`, or `win32`.
 * - Throws when a tree file cannot be read.
 * - Throws when a tree file is missing a type or path field.
 * - Throws when a tree file has too many tab-separated fields.
 * - Throws when a tree file uses an unknown entry type.
 * - Throws when a tree file contains an empty, absolute, or escaping path.
 * - Throws when loaded tree files define the same path with different entry types.
 */
export function readMockTreeFixture(
  fixture: MockTreeFixture,
  platform: MockTreePlatform = mockTreePlatformFromNodePlatform(),
): ResolvedMockTreeFixture {
  const commonTreeFile = path.join(fixture.rootDir, "tree.txt");
  const currentPlatformTreeFile = platformTreeFile(fixture.rootDir, platform);

  const entryGroups: Array<{ entries: MockTreeEntry[]; source: string }> = [];
  // Load the shared tree first so platform-specific files can override it later.
  if (fs.existsSync(commonTreeFile)) {
    entryGroups.push({ entries: readMockTree(commonTreeFile), source: commonTreeFile });
  }
  // Merge in the current platform tree when the fixture defines one.
  if (fs.existsSync(currentPlatformTreeFile)) {
    entryGroups.push({
      entries: readMockTree(currentPlatformTreeFile),
      source: currentPlatformTreeFile,
    });
  }
  if (entryGroups.length === 0) {
    throw new Error(
      `Mock tree fixture has no tree.txt or tree.${platform}.txt: ${fixture.rootDir}`,
    );
  }

  return {
    entries: mergeMockTreeEntries(entryGroups),
    filesDirs: [path.join(fixture.rootDir, "files"), platformFilesDir(fixture.rootDir, platform)],
  };
}

/**
 * Writes a mock tree fixture to disk and copies matching payload files.
 *
 * @param rootPath Destination root that receives the tree.
 * @param entries Tree entries to create.
 * @param options Optional payload source roots.
 * @returns Nothing.
 * # Errors
 * - Throws when an entry path is empty, absolute, or escapes the fixture root.
 * - Throws when a payload file has no matching `file` entry.
 * - Throws when an existing payload root in `filesDir` or `filesDirs` is not a directory.
 */
export function writeMockTree(
  rootPath: string,
  entries: MockTreeEntry[],
  options: WriteMockTreeOptions = {},
): void {
  const declaredFiles = new Set(
    entries.filter((entry) => entry.type === "file").map((entry) => entry.path),
  );

  for (const entry of entries) {
    validateFixturePath(entry.path);
    const destination = fixturePathToNative(rootPath, entry.path);
    if (entry.type === "dir") {
      // Create the directory tree before writing payload files into it.
      fs.mkdirSync(destination, { recursive: true });
    } else {
      // Create the parent directory so the file write succeeds.
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, "");
    }
  }

  const filesDirs = [
    ...(options.filesDir === undefined ? [] : [options.filesDir]),
    ...(options.filesDirs ?? []),
  ];
  for (const filesDir of filesDirs) {
    for (const payloadPath of collectPayloadFiles(filesDir)) {
      validateFixturePath(payloadPath);
      if (!declaredFiles.has(payloadPath)) {
        throw new Error(`Mock tree payload has no matching file entry: ${payloadPath}`);
      }
      fs.cpSync(
        fixturePathToNative(filesDir, payloadPath),
        fixturePathToNative(rootPath, payloadPath),
      );
    }
  }
}

/**
 * Reads and parses a mock tree file from disk.
 *
 * @param filePath Path to the tree file.
 * @returns The parsed mock tree entries from `filePath`.
 * # Errors
 * - Throws when the file cannot be read.
 * - Throws when the file is missing a type or path field.
 * - Throws when the file has too many tab-separated fields.
 * - Throws when the file uses an unknown entry type.
 * - Throws when the file contains an empty, absolute, or escaping path.
 */
export function readMockTree(filePath: string): MockTreeEntry[] {
  return parseMockTree(fs.readFileSync(filePath, "utf8"));
}

/**
 * Parses mock tree file contents into ordered entries.
 *
 * @param source Raw tree file contents.
 * @returns The ordered mock tree entries parsed from `source`.
 * # Errors
 * - Throws when a line is missing the type or path field.
 * - Throws when a line has too many tab-separated fields.
 * - Throws when a line uses an unknown entry type.
 * - Throws when a path is empty, absolute, or escapes the fixture root.
 */
export function parseMockTree(source: string): MockTreeEntry[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line, index) => {
      const [typePrefix, rawPath, ...rest] = line.split("\t");
      if (typePrefix === undefined || rawPath === undefined) {
        throw new Error(`Invalid mock tree line ${index + 1}: expected '<type>\\t<path>'`);
      }
      if (rest.length > 0) {
        throw new Error(`Invalid mock tree line ${index + 1}: too many fields`);
      }

      const type = TYPE_BY_PREFIX[typePrefix];
      if (type === undefined) {
        throw new Error(`Invalid mock tree line ${index + 1}: unknown entry type`);
      }

      const entryPath = normaliseFixturePath(rawPath);
      validateFixturePath(entryPath, index + 1);
      return { type, path: entryPath };
    });
}

/**
 * Converts a fixture-relative path to a native filesystem path.
 *
 * @param rootPath Fixture root directory.
 * @param fixturePath Fixture-relative path.
 * @returns The native filesystem path under `rootPath`.
 * # Errors
 * - Throws when the path is empty, absolute, or escapes the fixture root.
 */
export function fixturePathToNative(rootPath: string, fixturePath: string): string {
  const normalised = normaliseFixturePath(fixturePath);
  validateFixturePath(normalised);
  return path.join(rootPath, ...normalised.split("/"));
}

/**
 * Maps the current Node platform name to a mock tree platform name.
 *
 * @param nodePlatform Node platform name to map. Defaults to `process.platform`.
 * @returns The matching mock tree platform name.
 * # Errors
 * - Throws when the Node platform is not one of `darwin`, `linux`, or `win32`.
 */
export function mockTreePlatformFromNodePlatform(
  nodePlatform: string = process.platform,
): MockTreePlatform {
  switch (nodePlatform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported mock tree platform: ${nodePlatform}`);
  }
}

/**
 * Verifies that a fixture path stays relative to the mock tree root.
 *
 * @param entryPath Fixture-relative path to validate.
 * @param lineNumber Source line number for error text.
 * @returns Nothing.
 * # Errors
 * - Throws when the path is empty, absolute, or escapes the fixture root.
 */
export function validateFixturePath(entryPath: string, lineNumber?: number): void {
  const location = lineNumber === undefined ? "" : ` on line ${lineNumber}`;
  if (entryPath.length === 0) {
    throw new Error(`Invalid mock tree path${location}: empty path`);
  }
  if (path.isAbsolute(entryPath)) {
    throw new Error(`Invalid mock tree path${location}: absolute path`);
  }
  const normalised = path.posix.normalize(entryPath);
  if (normalised === ".." || normalised.startsWith("../")) {
    throw new Error(`Invalid mock tree path${location}: path escapes fixture root`);
  }
}

/**
 * Joins a fixture path under the fixture root using platform-native separators.
 */
function platformTreeFile(rootDir: string, platform: MockTreePlatform): string {
  return path.join(rootDir, `tree.${platform}.txt`);
}

/**
 * Returns the payload directory for a single platform.
 */
function platformFilesDir(rootDir: string, platform: MockTreePlatform): string {
  return path.join(rootDir, `files.${platform}`);
}

/**
 * Merges entries from multiple fixture files and keeps the result sorted.
 */
function mergeMockTreeEntries(
  entryGroups: Array<{ entries: MockTreeEntry[]; source: string }>,
): MockTreeEntry[] {
  const byPath = new Map<string, MockTreeEntry>();
  for (const group of entryGroups) {
    for (const entry of group.entries) {
      addEntry(byPath, entry, group.source);
    }
  }

  return [...byPath.values()].sort((lhs, rhs) => lhs.path.localeCompare(rhs.path));
}

/**
 * Stores one entry unless the same path already maps to a different type.
 */
function addEntry(entries: Map<string, MockTreeEntry>, entry: MockTreeEntry, source: string): void {
  const existing = entries.get(entry.path);
  if (existing !== undefined && existing.type !== entry.type) {
    throw new Error(
      `Conflicting mock tree entry for ${entry.path}: ${existing.type} vs ${entry.type} in ${source}`,
    );
  }
  entries.set(entry.path, entry);
}

/**
 * Collects every payload file path beneath a fixture payload directory.
 */
function collectPayloadFiles(filesDir: string): string[] {
  if (!fs.existsSync(filesDir)) return [];
  if (!fs.statSync(filesDir).isDirectory()) {
    throw new Error(`Mock tree files path is not a directory: ${filesDir}`);
  }

  const payloads: string[] = [];
  const visit = (absoluteDir: string): void => {
    for (const child of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, child.name);
      if (child.isDirectory()) {
        // Recurse first so nested payloads stay relative to the payload root.
        visit(absolutePath);
      } else if (child.isFile()) {
        payloads.push(normaliseFixturePath(path.relative(filesDir, absolutePath)));
      }
    }
  };
  visit(filesDir);
  return payloads;
}

const TYPE_BY_PREFIX: Record<string, MockTreeEntryType> = {
  d: "dir",
  f: "file",
};

/**
 * Normalizes fixture paths to forward slashes and strips a leading `./`.
 *
 * @param input Raw fixture path.
 * @returns The normalized fixture path.
 */
export function normaliseFixturePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}
