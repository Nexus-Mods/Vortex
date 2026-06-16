import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normaliseFixturePath, validateFixturePath, type MockTreeEntry } from "./mock-tree";

function usage(): never {
  throw new Error(
    "Usage: pnpm --filter @vortex/e2e run fixture:export-tree -- <source-dir> <fixture-dir> [--payload <relative-path> ...] [--file <relative-path> ...] [--dir <relative-path> ...]",
  );
}

interface ExportOptions {
  payloads: string[];
  extraFiles: string[];
  extraDirs: string[];
}

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

function addEntry(entries: Map<string, MockTreeEntry>, entry: MockTreeEntry): void {
  const existing = entries.get(entry.path);
  if (existing !== undefined && existing.type !== entry.type) {
    throw new Error(
      `Conflicting mock tree entry for ${entry.path}: ${existing.type} vs ${entry.type}`,
    );
  }
  entries.set(entry.path, entry);
}

function addParentDirs(entries: Map<string, MockTreeEntry>, entryPath: string): void {
  let parent = normaliseFixturePath(path.posix.dirname(entryPath));
  while (parent !== "." && parent !== "") {
    addEntry(entries, { type: "dir", path: parent });
    parent = normaliseFixturePath(path.posix.dirname(parent));
  }
}

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

  const entries = mergeExtraEntries(collectEntries(resolvedRoot), options);
  const lines = [
    "# mock-tree-v1",
    "# Format: d<TAB><relative directory> or f<TAB><relative file>",
    ...entries.map((entry) => `${entry.type === "dir" ? "d" : "f"}\t${entry.path}`),
    "",
  ];

  fs.rmSync(path.join(resolvedFixtureDir, "files"), { recursive: true, force: true });
  fs.mkdirSync(resolvedFixtureDir, { recursive: true });
  fs.writeFileSync(path.join(resolvedFixtureDir, "tree.txt"), lines.join("\n"));
  copyPayloads(resolvedRoot, path.join(resolvedFixtureDir, "files"), options.payloads);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
