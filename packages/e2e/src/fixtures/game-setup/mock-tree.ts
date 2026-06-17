import fs from "node:fs";
import path from "node:path";

export type MockTreeEntryType = "dir" | "file";

export type MockTreePlatform = "windows" | "linux" | "macos";

export const MOCK_TREE_PLATFORMS = [
  "windows",
  "linux",
  "macos",
] as const satisfies readonly MockTreePlatform[];

export interface MockTreeEntry {
  type: MockTreeEntryType;
  path: string;
}

export interface MockTreeFixture {
  rootDir: string;
}

export interface ResolvedMockTreeFixture {
  entries: MockTreeEntry[];
  filesDirs: string[];
}

interface WriteMockTreeOptions {
  filesDir?: string;
  filesDirs?: string[];
}

const TYPE_BY_PREFIX: Record<string, MockTreeEntryType> = {
  d: "dir",
  f: "file",
};

export function normaliseFixturePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

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

export function readMockTree(filePath: string): MockTreeEntry[] {
  return parseMockTree(fs.readFileSync(filePath, "utf8"));
}

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

function platformTreeFile(rootDir: string, platform: MockTreePlatform): string {
  return path.join(rootDir, `tree.${platform}.txt`);
}

function platformFilesDir(rootDir: string, platform: MockTreePlatform): string {
  return path.join(rootDir, `files.${platform}`);
}

function addEntry(entries: Map<string, MockTreeEntry>, entry: MockTreeEntry, source: string): void {
  const existing = entries.get(entry.path);
  if (existing !== undefined && existing.type !== entry.type) {
    throw new Error(
      `Conflicting mock tree entry for ${entry.path}: ${existing.type} vs ${entry.type} in ${source}`,
    );
  }
  entries.set(entry.path, entry);
}

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

export function readMockTreeFixture(
  fixture: MockTreeFixture,
  platform: MockTreePlatform = mockTreePlatformFromNodePlatform(),
): ResolvedMockTreeFixture {
  const commonTreeFile = path.join(fixture.rootDir, "tree.txt");
  const currentPlatformTreeFile = platformTreeFile(fixture.rootDir, platform);

  const entryGroups: Array<{ entries: MockTreeEntry[]; source: string }> = [];
  if (fs.existsSync(commonTreeFile)) {
    entryGroups.push({ entries: readMockTree(commonTreeFile), source: commonTreeFile });
  }
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

export function fixturePathToNative(rootPath: string, fixturePath: string): string {
  const normalised = normaliseFixturePath(fixturePath);
  validateFixturePath(normalised);
  return path.join(rootPath, ...normalised.split("/"));
}

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
        visit(absolutePath);
      } else if (child.isFile()) {
        payloads.push(normaliseFixturePath(path.relative(filesDir, absolutePath)));
      }
    }
  };
  visit(filesDir);
  return payloads;
}

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
      fs.mkdirSync(destination, { recursive: true });
    } else {
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
