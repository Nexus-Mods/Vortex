import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOCK_TREE_PLATFORMS,
  normaliseFixturePath,
  validateFixturePath,
  type MockTreeEntry,
  type MockTreePlatform,
} from "./mock-tree";

function usage(): never {
  throw new Error(
    "Usage: pnpm --filter @vortex/e2e run fixture:export-platform-trees -- --out <fixture-dir> --platform <windows|linux|macos>=<source-dir> [--platform <platform>=<source-dir> ...] [--payload <relative-path> ...] [--file <relative-path> ...] [--dir <relative-path> ...] [--platform-file <platform>:<relative-path> ...] [--platform-dir <platform>:<relative-path> ...]",
  );
}

export interface ExportPlatformTreesOptions {
  outDir: string;
  platforms: Map<MockTreePlatform, string>;
  payloads: string[];
  extraFiles: string[];
  extraDirs: string[];
  platformExtraFiles: Map<MockTreePlatform, string[]>;
  platformExtraDirs: Map<MockTreePlatform, string[]>;
}

interface PlatformEntries {
  rootPath: string;
  entries: Map<string, MockTreeEntry>;
}

function isMockTreePlatform(input: string): input is MockTreePlatform {
  return (MOCK_TREE_PLATFORMS as readonly string[]).includes(input);
}

function parsePlatformValue(value: string): { platform: MockTreePlatform; value: string } {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex === -1) usage();
  const platform = value.slice(0, separatorIndex);
  const platformValue = value.slice(separatorIndex + 1);
  if (!isMockTreePlatform(platform) || platformValue.length === 0) usage();
  return { platform, value: platformValue };
}

function parsePlatformPathValue(value: string): { platform: MockTreePlatform; entryPath: string } {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) usage();
  const platform = value.slice(0, separatorIndex);
  const rawPath = value.slice(separatorIndex + 1);
  if (!isMockTreePlatform(platform) || rawPath.length === 0) usage();
  return { platform, entryPath: normaliseAndValidate(rawPath) };
}

function normaliseAndValidate(input: string): string {
  const normalised = normaliseFixturePath(input);
  validateFixturePath(normalised);
  return normalised;
}

function pushMapValue<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function parseArgs(args: string[], invocationCwd: string): ExportPlatformTreesOptions {
  const options: ExportPlatformTreesOptions = {
    outDir: "",
    platforms: new Map(),
    payloads: [],
    extraFiles: [],
    extraDirs: [],
    platformExtraFiles: new Map(),
    platformExtraDirs: new Map(),
  };

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === undefined || value === undefined) usage();

    switch (flag) {
      case "--out":
        options.outDir = path.resolve(invocationCwd, value);
        break;
      case "--platform": {
        const parsed = parsePlatformValue(value);
        options.platforms.set(parsed.platform, path.resolve(invocationCwd, parsed.value));
        break;
      }
      case "--payload":
        options.payloads.push(normaliseAndValidate(value));
        break;
      case "--file":
        options.extraFiles.push(normaliseAndValidate(value));
        break;
      case "--dir":
        options.extraDirs.push(normaliseAndValidate(value));
        break;
      case "--platform-file": {
        const parsed = parsePlatformPathValue(value);
        pushMapValue(options.platformExtraFiles, parsed.platform, parsed.entryPath);
        break;
      }
      case "--platform-dir": {
        const parsed = parsePlatformPathValue(value);
        pushMapValue(options.platformExtraDirs, parsed.platform, parsed.entryPath);
        break;
      }
      default:
        usage();
    }
  }

  if (options.outDir.length === 0 || options.platforms.size < 2) usage();
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

function addSyntheticEntries(
  entries: Map<string, MockTreeEntry>,
  extraFiles: string[],
  extraDirs: string[],
): void {
  for (const dirPath of extraDirs) {
    addParentDirs(entries, dirPath);
    addEntry(entries, { type: "dir", path: dirPath });
  }

  for (const filePath of extraFiles) {
    addParentDirs(entries, filePath);
    addEntry(entries, { type: "file", path: filePath });
  }
}

function collectPlatformEntries(
  options: ExportPlatformTreesOptions,
): Map<MockTreePlatform, PlatformEntries> {
  const result = new Map<MockTreePlatform, PlatformEntries>();

  for (const [platform, rootPath] of options.platforms) {
    if (!fs.statSync(rootPath).isDirectory()) {
      throw new Error(`Game directory does not exist: ${rootPath}`);
    }

    const entries = new Map<string, MockTreeEntry>();
    for (const entry of collectEntries(rootPath)) addEntry(entries, entry);
    addSyntheticEntries(entries, options.extraFiles, options.extraDirs);
    addSyntheticEntries(
      entries,
      options.platformExtraFiles.get(platform) ?? [],
      options.platformExtraDirs.get(platform) ?? [],
    );
    result.set(platform, { rootPath, entries });
  }

  return result;
}

function getPayloadBytes(
  platformEntries: PlatformEntries,
  payloadPath: string,
): Buffer | undefined {
  const entry = platformEntries.entries.get(payloadPath);
  if (entry?.type !== "file") return undefined;
  const source = path.join(platformEntries.rootPath, ...payloadPath.split("/"));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Payload file does not exist: ${source}`);
  }
  return fs.readFileSync(source);
}

function allPayloadBytesMatch(
  platforms: MockTreePlatform[],
  platformEntries: Map<MockTreePlatform, PlatformEntries>,
  payloadPath: string,
): boolean {
  let expected: Buffer | undefined;
  for (const platform of platforms) {
    const entries = platformEntries.get(platform);
    if (entries === undefined) throw new Error(`Missing platform entries: ${platform}`);
    const bytes = getPayloadBytes(entries, payloadPath);
    if (bytes === undefined) return false;
    if (expected === undefined) {
      expected = bytes;
    } else if (!expected.equals(bytes)) {
      return false;
    }
  }
  return true;
}

function canUseCommonEntry(
  entryPath: string,
  platforms: MockTreePlatform[],
  platformEntries: Map<MockTreePlatform, PlatformEntries>,
  payloads: Set<string>,
): boolean {
  let expectedType: MockTreeEntry["type"] | undefined;
  for (const platform of platforms) {
    const entries = platformEntries.get(platform);
    if (entries === undefined) throw new Error(`Missing platform entries: ${platform}`);
    const entry = entries.entries.get(entryPath);
    if (entry === undefined) return false;
    expectedType ??= entry.type;
    if (entry.type !== expectedType) return false;
  }

  return (
    expectedType !== "file" ||
    !payloads.has(entryPath) ||
    allPayloadBytesMatch(platforms, platformEntries, entryPath)
  );
}

function splitEntries(
  platformEntries: Map<MockTreePlatform, PlatformEntries>,
  payloads: Set<string>,
): { common: MockTreeEntry[]; platformSpecific: Map<MockTreePlatform, MockTreeEntry[]> } {
  const platforms = [...platformEntries.keys()];
  const common: MockTreeEntry[] = [];
  const platformSpecific = new Map<MockTreePlatform, MockTreeEntry[]>();
  const allPaths = new Set<string>();

  for (const entries of platformEntries.values()) {
    for (const entryPath of entries.entries.keys()) allPaths.add(entryPath);
  }

  for (const entryPath of [...allPaths].sort((lhs, rhs) => lhs.localeCompare(rhs))) {
    if (canUseCommonEntry(entryPath, platforms, platformEntries, payloads)) {
      const firstPlatform = platforms[0];
      if (firstPlatform === undefined) throw new Error("No platforms supplied");
      const entry = platformEntries.get(firstPlatform)?.entries.get(entryPath);
      if (entry === undefined) throw new Error(`Missing common entry: ${entryPath}`);
      common.push(entry);
      continue;
    }

    for (const platform of platforms) {
      const entry = platformEntries.get(platform)?.entries.get(entryPath);
      if (entry === undefined) continue;
      pushMapValue(platformSpecific, platform, entry);
    }
  }

  return { common, platformSpecific };
}

function treeLines(entries: MockTreeEntry[]): string[] {
  return [
    "# mock-tree-v1",
    "# Format: d<TAB><relative directory> or f<TAB><relative file>",
    ...entries.map((entry) => `${entry.type === "dir" ? "d" : "f"}\t${entry.path}`),
    "",
  ];
}

function copyPayload(sourceRoot: string, filesDir: string, payloadPath: string): void {
  const source = path.join(sourceRoot, ...payloadPath.split("/"));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Payload file does not exist: ${source}`);
  }

  const destination = path.join(filesDir, ...payloadPath.split("/"));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination);
}

function writePayloads(
  outDir: string,
  platformEntries: Map<MockTreePlatform, PlatformEntries>,
  split: { common: MockTreeEntry[]; platformSpecific: Map<MockTreePlatform, MockTreeEntry[]> },
  payloads: Set<string>,
): void {
  const commonFiles = new Set(
    split.common.filter((entry) => entry.type === "file").map((entry) => entry.path),
  );
  const firstPlatform = platformEntries.keys().next().value;
  if (firstPlatform === undefined) throw new Error("No platforms supplied");

  for (const payloadPath of payloads) {
    if (commonFiles.has(payloadPath)) {
      const source = platformEntries.get(firstPlatform);
      if (source === undefined) throw new Error(`Missing platform entries: ${firstPlatform}`);
      copyPayload(source.rootPath, path.join(outDir, "files"), payloadPath);
      continue;
    }

    let copied = false;
    for (const [platform, entries] of split.platformSpecific) {
      if (entries.some((entry) => entry.type === "file" && entry.path === payloadPath)) {
        const source = platformEntries.get(platform);
        if (source === undefined) throw new Error(`Missing platform entries: ${platform}`);
        copyPayload(source.rootPath, path.join(outDir, `files.${platform}`), payloadPath);
        copied = true;
      }
    }
    if (!copied) throw new Error(`Payload has no matching file entry: ${payloadPath}`);
  }
}

function cleanOutput(outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(path.join(outDir, "tree.txt"), { force: true });
  fs.rmSync(path.join(outDir, "files"), { recursive: true, force: true });
  for (const platform of MOCK_TREE_PLATFORMS) {
    fs.rmSync(path.join(outDir, `tree.${platform}.txt`), { force: true });
    fs.rmSync(path.join(outDir, `files.${platform}`), { recursive: true, force: true });
  }
}

export function exportPlatformTrees(options: ExportPlatformTreesOptions): void {
  const platformEntries = collectPlatformEntries(options);
  const payloads = new Set(options.payloads);
  const split = splitEntries(platformEntries, payloads);

  cleanOutput(options.outDir);
  fs.writeFileSync(path.join(options.outDir, "tree.txt"), treeLines(split.common).join("\n"));
  for (const [platform, entries] of split.platformSpecific) {
    if (entries.length === 0) continue;
    fs.writeFileSync(
      path.join(options.outDir, `tree.${platform}.txt`),
      treeLines(entries).join("\n"),
    );
  }
  writePayloads(options.outDir, platformEntries, split, payloads);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
  const invocationCwd = process.env.INIT_CWD ?? process.cwd();
  exportPlatformTrees(parseArgs(args, invocationCwd));
}
