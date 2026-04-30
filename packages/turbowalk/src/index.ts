import Bluebird from "bluebird";
import * as fs from "fs";
import * as path from "path";

export interface IEntry {
  filePath: string;
  isDirectory: boolean;
  isReparsePoint: boolean;
  size: number;
  mtime: number;
  isTerminator?: boolean;
  id?: number;
  idStr?: string;
  linkCount?: number;
}

export interface IWalkOptions {
  terminators?: boolean;
  details?: boolean;
  threshold?: number;
  recurse?: boolean;
  skipHidden?: boolean;
  skipLinks?: boolean;
  skipInaccessible?: boolean;
}

const DEFAULTS: Required<IWalkOptions> = {
  terminators: false,
  details: false,
  threshold: 1024,
  recurse: true,
  skipHidden: true,
  skipLinks: true,
  skipInaccessible: true,
};

// --- Windows: koffi FFI using NtQueryDirectoryFile ---

let walkDirWindows: ((
  dirPath: string,
  progress: (entries: IEntry[]) => void,
  opts: Required<IWalkOptions>,
) => void) | undefined;

if (process.platform === "win32") {
  try {
    // Dynamic require so it doesn't fail on Linux
    const mod = require("./walkWindows") as {
      walkDirWindows: typeof walkDirWindows;
    };
    walkDirWindows = mod.walkDirWindows;
  } catch {
    // koffi not available — fall through to TS fallback
  }
}

// --- Linux/fallback: async fs.readdir + concurrent lstat ---

const STAT_CONCURRENCY = 64;

async function statBatch(
  paths: string[],
  opts: Required<IWalkOptions>,
): Promise<(fs.Stats | null)[]> {
  const results: (fs.Stats | null)[] = new Array(paths.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < paths.length) {
      const idx = cursor++;
      try {
        results[idx] = await fs.promises.lstat(paths[idx]!);
      } catch (err: any) {
        if (
          opts.skipInaccessible &&
          (err?.code === "EACCES" || err?.code === "EPERM" || err?.code === "ENOENT")
        ) {
          results[idx] = null;
        } else {
          throw err;
        }
      }
    }
  }

  const workers = Math.min(STAT_CONCURRENCY, paths.length);
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < workers; i++) tasks.push(next());
  await Promise.all(tasks);
  return results;
}

async function walkDirFallback(
  dirPath: string,
  progress: (entries: IEntry[]) => void,
  opts: Required<IWalkOptions>,
): Promise<void> {
  let names: string[];
  try {
    names = await fs.promises.readdir(dirPath);
  } catch (err: any) {
    if (err?.code === "ENOENT") return;
    if (opts.skipInaccessible && (err?.code === "EACCES" || err?.code === "EPERM")) return;
    throw err;
  }

  if (opts.skipHidden) {
    names = names.filter((n) => !n.startsWith("."));
  }

  const fullPaths = names.map((n) => path.join(dirPath, n));
  const statResults = await statBatch(fullPaths, opts);

  const entries: IEntry[] = [];
  const subDirs: string[] = [];

  for (let i = 0; i < names.length; i++) {
    const stats = statResults[i]!;
    if (stats === null) continue;

    const fullPath = fullPaths[i]!;
    const isLink = stats.isSymbolicLink();
    const isDir = stats.isDirectory();

    entries.push({
      filePath: fullPath,
      isDirectory: isDir,
      isReparsePoint: isLink,
      size: stats.size,
      mtime: Math.floor(stats.mtimeMs / 1000),
      ...(opts.details
        ? { id: stats.ino, idStr: String(stats.ino), linkCount: stats.nlink }
        : {}),
    });

    if (isDir && opts.recurse && !(opts.skipLinks && isLink)) {
      subDirs.push(fullPath);
    }
  }

  if (entries.length > 0) {
    progress(entries);
  }

  for (const sub of subDirs) {
    await walkDirFallback(sub, progress, opts);
  }
}

// --- Public API ---

function turbowalk(
  basePath: string,
  progress: (entries: IEntry[]) => void,
  options?: IWalkOptions,
): Bluebird<void> {
  if (basePath === undefined) {
    throw new Error("expected at least one parameter");
  }
  const opts = { ...DEFAULTS, ...options };
  const normalized = path.normalize(basePath);

  if (walkDirWindows !== undefined) {
    try {
      walkDirWindows(normalized, progress, opts);
      return Bluebird.resolve();
    } catch (err) {
      return Bluebird.reject(err);
    }
  }

  return Bluebird.resolve(walkDirFallback(normalized, progress, opts));
}

export default turbowalk;
