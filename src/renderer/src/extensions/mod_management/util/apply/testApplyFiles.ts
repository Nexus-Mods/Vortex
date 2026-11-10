import { folderKeyOf, parentFolders, pathKeyOf } from "@nexusmods/mod-pipeline";

import type { ApplyFiles } from "./apply";
import type { JournalStorage } from "./journal";

/** A disk as fixtures write it. */
export interface FixtureDisk {
  /** contents by path; paths with the same contents are hardlinks of one file */
  files: Record<string, string>;
  /** the folders that hold nothing; those above a file are implied */
  folders?: string[];
}

interface DiskFile {
  id: string;
  contents: string;
}

type DiskNode = { path: string; folderId: string } | { path: string; file: DiskFile };

/** An in-memory disk for Apply's tests, matching paths ignoring letter case as on Windows. */
export class MemoryDisk {
  /** by path key */
  readonly #nodes = new Map<string, DiskNode>();
  #lastId = 0;

  constructor({ files, folders = [] }: FixtureDisk) {
    const fileByContents = new Map<string, DiskFile>();
    for (const folder of folders) {
      this.#createFolder(folder);
    }
    for (const [path, contents] of Object.entries(files)) {
      const file = fileByContents.get(contents) ?? { id: this.#newId(), contents };
      fileByContents.set(contents, file);
      this.#createParents(path);
      this.#nodes.set(pathKeyOf(path), { path, file });
    }
  }

  /** The disk as fixtures write it. */
  snapshot(): FixtureDisk {
    const nodes = [...this.#nodes.values()].toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : 1));
    const files: Record<string, string> = {};
    const folders: string[] = [];
    for (const node of nodes) {
      if ("file" in node) {
        files[node.path] = node.file.contents;
      } else if (this.#isEmpty(node.path)) {
        folders.push(node.path);
      }
    }
    return folders.length > 0 ? { files, folders } : { files };
  }

  /** Apply's file work on this disk. */
  files(): ApplyFiles {
    return {
      statusAt: (path) => Promise.try(() => this.#statusAt(path)),
      move: (from, to) => Promise.try(() => this.#move(from, to)),
      link: (from, to) => Promise.try(() => this.#link(from, to)),
      remove: (path) => Promise.try(() => this.#remove(path)),
      createFolder: (path) => Promise.try(() => this.#createFolder(path)),
      removeEmptyFolder: (path) => Promise.try(() => this.#removeEmptyFolder(path)),
    };
  }

  #newId(): string {
    this.#lastId += 1;
    return String(this.#lastId);
  }

  #statusAt(path: string): { id: string; linkCount: number } | undefined {
    const node = this.#nodes.get(pathKeyOf(path));
    if (node === undefined) {
      return undefined;
    }
    if (!("file" in node)) {
      return { id: node.folderId, linkCount: 1 };
    }
    const linkCount = [...this.#nodes.values()].filter(
      (other) => "file" in other && other.file === node.file,
    ).length;
    return { id: node.file.id, linkCount };
  }

  #isEmpty(folder: string): boolean {
    const prefix = folderKeyOf(folder);
    return ![...this.#nodes.keys()].some((key) => key.startsWith(prefix));
  }

  /** Throws unless `path` is free and the folder it goes in is there. */
  #checkFree(path: string): void {
    if (this.#nodes.has(pathKeyOf(path))) {
      throw new Error(`${path} is taken`);
    }
    const [folder] = parentFolders(path);
    const parent = folder === undefined ? undefined : this.#nodes.get(pathKeyOf(folder));
    if (folder !== undefined && (parent === undefined || "file" in parent)) {
      throw new Error(`there is no folder ${folder}`);
    }
  }

  #move(from: string, to: string): void {
    const node = this.#nodes.get(pathKeyOf(from));
    if (node === undefined) {
      throw new Error(`there is nothing at ${from}`);
    }
    this.#checkFree(to);
    const fromKey = pathKeyOf(from);
    const prefix = folderKeyOf(from);
    const moving = [...this.#nodes].filter(([key]) => key === fromKey || key.startsWith(prefix));
    for (const [key, moved] of moving) {
      this.#nodes.delete(key);
      const path = to + moved.path.slice(from.length);
      this.#nodes.set(pathKeyOf(path), { ...moved, path });
    }
  }

  #link(from: string, to: string): void {
    const node = this.#nodes.get(pathKeyOf(from));
    if (node === undefined || !("file" in node)) {
      throw new Error(`there is no file at ${from}`);
    }
    this.#checkFree(to);
    this.#nodes.set(pathKeyOf(to), { path: to, file: node.file });
  }

  #remove(path: string): void {
    const node = this.#nodes.get(pathKeyOf(path));
    if (node === undefined || !("file" in node)) {
      throw new Error(`there is no file at ${path}`);
    }
    this.#nodes.delete(pathKeyOf(path));
  }

  #createParents(path: string): void {
    const [folder] = parentFolders(path);
    if (folder !== undefined) {
      this.#createFolder(folder);
    }
  }

  #createFolder(path: string): void {
    for (const folder of [path, ...parentFolders(path)].toReversed()) {
      const node = this.#nodes.get(pathKeyOf(folder));
      if (node === undefined) {
        this.#nodes.set(pathKeyOf(folder), { path: folder, folderId: this.#newId() });
      } else if ("file" in node) {
        throw new Error(`${folder} is a file`);
      }
    }
  }

  #removeEmptyFolder(path: string): void {
    const node = this.#nodes.get(pathKeyOf(path));
    if (node !== undefined && !("file" in node) && this.#isEmpty(path)) {
      this.#nodes.delete(pathKeyOf(path));
    }
  }
}

/** Every file and journal call after the first `calls` fails, as in a killed process. */
export function killAfter(calls: number): {
  files: (files: ApplyFiles) => ApplyFiles;
  journal: (journal: JournalStorage) => JournalStorage;
  callsUsed: () => number;
} {
  let used = 0;
  const guarded = async <T>(call: () => Promise<T>) => {
    if (used++ >= calls) {
      throw new Error("killed");
    }
    return call();
  };
  return {
    files: (files) => ({
      statusAt: (path) => guarded(() => files.statusAt(path)),
      move: (from, to) => guarded(() => files.move(from, to)),
      link: (from, to) => guarded(() => files.link(from, to)),
      remove: (path) => guarded(() => files.remove(path)),
      createFolder: (path) => guarded(() => files.createFolder(path)),
      removeEmptyFolder: (path) => guarded(() => files.removeEmptyFolder(path)),
    }),
    journal: (journal) => ({
      read: () => guarded(() => journal.read()),
      create: (contents) => guarded(() => journal.create(contents)),
      write: (contents) => guarded(() => journal.write(contents)),
      append: async (contents) => {
        // the kill tears the line it lands on
        if (used === calls) {
          await journal.append(contents.subarray(0, contents.length >> 1));
        }
        return guarded(() => journal.append(contents));
      },
      remove: () => guarded(() => journal.remove()),
      close: () => guarded(() => journal.close()),
    }),
    callsUsed: () => used,
  };
}
