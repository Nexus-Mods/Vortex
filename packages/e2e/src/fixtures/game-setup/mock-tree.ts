import fs from "node:fs";
import path from "node:path";

export type MockTreeEntryType = "dir" | "file";

export interface MockTreeEntry {
  type: MockTreeEntryType;
  path: string;
}

export interface MockTreeFixture {
  treeFile: string;
  filesDir: string;
}

interface WriteMockTreeOptions {
  filesDir?: string;
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
    const destination = path.join(rootPath, ...entry.path.split("/"));
    if (entry.type === "dir") {
      fs.mkdirSync(destination, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, "");
    }
  }

  if (options.filesDir === undefined) return;

  for (const payloadPath of collectPayloadFiles(options.filesDir)) {
    validateFixturePath(payloadPath);
    if (!declaredFiles.has(payloadPath)) {
      throw new Error(`Mock tree payload has no matching file entry: ${payloadPath}`);
    }
    fs.cpSync(
      path.join(options.filesDir, ...payloadPath.split("/")),
      path.join(rootPath, ...payloadPath.split("/")),
    );
  }
}
