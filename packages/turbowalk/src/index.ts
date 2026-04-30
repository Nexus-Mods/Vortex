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
        results[idx] = await fs.promises.lstat(paths[idx]);
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
  await Promise.all(Array.from({ length: workers }, () => next()));
  return results;
}

async function walkDir(
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
    const stats = statResults[i];
    if (stats === null) continue;

    const fullPath = fullPaths[i];
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
    await walkDir(sub, progress, opts);
  }
}

function turbowalk(
  basePath: string,
  progress: (entries: IEntry[]) => void,
  options?: IWalkOptions,
): Bluebird<void> {
  if (basePath === undefined) {
    throw new Error("expected at least one parameter");
  }
  const opts = { ...DEFAULTS, ...options };
  return Bluebird.resolve(walkDir(path.normalize(basePath), progress, opts));
}

export default turbowalk;
