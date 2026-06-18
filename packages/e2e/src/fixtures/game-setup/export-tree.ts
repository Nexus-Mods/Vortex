import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normaliseFixturePath, validateFixturePath, type MockTreeEntry } from "./mock-tree";

/**
 * Export a game directory as a mock-tree fixture.
 */
// Entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // pnpm forwards a leading "--" separator before script arguments.
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
  const [sourceDir, fixtureDir, ...rest] = args;
  if (sourceDir === undefined || fixtureDir === undefined) usage();
  const invocationCwd = process.env.INIT_CWD ?? process.cwd();
  exportMockTree(
    path.resolve(invocationCwd, sourceDir),
    path.resolve(invocationCwd, fixtureDir),
    parseArgs(rest),
  );
}

/**
 * Write a mock-tree snapshot for a game directory.
 *
 * @param rootPath - Source game directory to export.
 * @param fixtureDir - Fixture directory that receives `tree.txt` and `files/`.
 * @param options - Extra mock-tree entries and payload files to include.
 * @throws Error when `rootPath` is missing or cannot be read.
 * @throws Error when `rootPath` exists but is not a directory.
 * @throws Error when `fixtureDir/files` cannot be removed.
 * @throws Error when `fixtureDir` cannot be created or `tree.txt` cannot be written.
 * @throws Error when a payload destination cannot be created or copied.
 * @throws Error when an extra entry uses a path that already exists with a different type.
 * @throws Error when a requested payload path does not exist or is not a file.
 */
export function exportMockTree(
  rootPath: string,
  fixtureDir: string,
  options: ExportOptions = { payloads: [], extraFiles: [], extraDirs: [] },
): void {
  const resolvedRoot = path.resolve(rootPath);
  if (!fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Game directory does not exist: ${resolvedRoot}`);
  }
  const resolvedFixtureDir = path.resolve(fixtureDir);

  // Snapshot the source tree, then merge any synthetic entries requested by the caller.
  const entries = mergeExtraEntries(collectEntries(resolvedRoot), options);
  const lines = [
    "# mock-tree-v1",
    "# Format: d<TAB><relative directory> or f<TAB><relative file>",
    ...entries.map((entry) => `${entry.type === "dir" ? "d" : "f"}\t${entry.path}`),
    "",
  ];

  // Rebuild the fixture output before writing the new tree and payload files.
  fs.rmSync(path.join(resolvedFixtureDir, "files"), { recursive: true, force: true });
  fs.mkdirSync(resolvedFixtureDir, { recursive: true });
  fs.writeFileSync(path.join(resolvedFixtureDir, "tree.txt"), lines.join("\n"));
  copyPayloads(resolvedRoot, path.join(resolvedFixtureDir, "files"), options.payloads);
}

interface ExportOptions {
  payloads: string[];
  extraFiles: string[];
  extraDirs: string[];
}

/**
 * Collect all directories and files under a root path.
 *
 * @param rootPath - Absolute path to the tree root.
 * @returns Tree entries sorted by directory traversal order.
 */
function collectEntries(rootPath: string): MockTreeEntry[] {
  const entries: MockTreeEntry[] = [];

  const visit = (absoluteDir: string): void => {
    const children = fs
      .readdirSync(absoluteDir, { withFileTypes: true })
      .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    for (const child of children) {
      const absolutePath = path.join(absoluteDir, child.name);
      const relativePath = normaliseFixturePath(path.relative(rootPath, absolutePath));
      if (child.isDirectory()) {
        entries.push({ type: "dir", path: relativePath });
        visit(absolutePath);
      } else if (child.isFile()) {
        entries.push({ type: "file", path: relativePath });
      }
    }
  };

  visit(rootPath);
  return entries;
}

/**
 * Merge exported entries with caller-supplied synthetic entries.
 *
 * @param entries - Entries discovered from the source tree.
 * @param options - Extra files and directories to append.
 * @returns A path-sorted list of unique entries.
 */
function mergeExtraEntries(entries: MockTreeEntry[], options: ExportOptions): MockTreeEntry[] {
  const byPath = new Map<string, MockTreeEntry>();
  for (const entry of entries) addEntry(byPath, entry);

  for (const dirPath of options.extraDirs) {
    addParentDirs(byPath, dirPath);
    addEntry(byPath, { type: "dir", path: dirPath });
  }

  for (const filePath of options.extraFiles) {
    addParentDirs(byPath, filePath);
    addEntry(byPath, { type: "file", path: filePath });
  }

  return [...byPath.values()].sort((lhs, rhs) => lhs.path.localeCompare(rhs.path));
}

/**
 * Store a mock-tree entry and reject path-type conflicts.
 *
 * @param entries - Entry map keyed by fixture path.
 * @param entry - Entry to insert.
 * @throws Error when the same path already exists with a different type.
 */
function addEntry(entries: Map<string, MockTreeEntry>, entry: MockTreeEntry): void {
  const existing = entries.get(entry.path);
  if (existing !== undefined && existing.type !== entry.type) {
    throw new Error(
      `Conflicting mock tree entry for ${entry.path}: ${existing.type} vs ${entry.type}`,
    );
  }
  entries.set(entry.path, entry);
}

/**
 * Add every parent directory for a fixture path.
 *
 * @param entries - Entry map keyed by fixture path.
 * @param entryPath - Child path that determines which parents to add.
 */
function addParentDirs(entries: Map<string, MockTreeEntry>, entryPath: string): void {
  let parent = normaliseFixturePath(path.posix.dirname(entryPath));
  while (parent !== "." && parent !== "") {
    addEntry(entries, { type: "dir", path: parent });
    parent = normaliseFixturePath(path.posix.dirname(parent));
  }
}

/**
 * Copy requested payload files into the exported fixture tree.
 *
 * @param rootPath - Source game directory.
 * @param outputFilesDir - Destination directory for payloads.
 * @param payloads - Relative payload paths to copy.
 * @throws Error when a requested payload path does not exist or is not a file.
 */
function copyPayloads(rootPath: string, outputFilesDir: string, payloads: string[]): void {
  for (const payloadPath of payloads) {
    const source = path.join(rootPath, ...payloadPath.split("/"));
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error(`Payload file does not exist: ${source}`);
    }

    const destination = path.join(outputFilesDir, ...payloadPath.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination);
  }
}

/**
 * Parse the CLI flags for the export script.
 *
 * @param args - Raw CLI arguments after the source and fixture directories.
 * @returns Parsed export options.
 */
function parseArgs(args: string[]): ExportOptions {
  const options: ExportOptions = { payloads: [], extraFiles: [], extraDirs: [] };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === undefined || value === undefined) usage();

    const normalised = normaliseFixturePath(value);
    validateFixturePath(normalised);

    switch (flag) {
      case "--payload":
        options.payloads.push(normalised);
        break;
      case "--file":
        options.extraFiles.push(normalised);
        break;
      case "--dir":
        options.extraDirs.push(normalised);
        break;
      default:
        usage();
    }
  }
  return options;
}

/**
 * Throw the CLI usage string as an error.
 */
function usage(): never {
  throw new Error(
    "Usage: pnpm --filter @vortex/e2e run fixture:export-tree -- <source-dir> <fixture-dir> [--payload <relative-path> ...] [--file <relative-path> ...] [--dir <relative-path> ...]",
  );
}
