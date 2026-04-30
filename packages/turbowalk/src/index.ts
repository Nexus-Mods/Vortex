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

  const entries: IEntry[] = [];
  const subDirs: string[] = [];

  for (const name of names) {
    if (opts.skipHidden && name.startsWith(".")) continue;

    const fullPath = path.join(dirPath, name);
    let stats: fs.Stats;
    try {
      stats = await fs.promises.lstat(fullPath);
    } catch (err: any) {
      if (opts.skipInaccessible && (err?.code === "EACCES" || err?.code === "EPERM" || err?.code === "ENOENT")) {
        continue;
      }
      throw err;
    }

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

async function turbowalk(
  basePath: string,
  progress: (entries: IEntry[]) => void,
  options?: IWalkOptions,
): Promise<void> {
  if (basePath === undefined) {
    throw new Error("expected at least one parameter");
  }
  const opts = { ...DEFAULTS, ...options };
  await walkDir(path.normalize(basePath), progress, opts);
}

export default turbowalk;
