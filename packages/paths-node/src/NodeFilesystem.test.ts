import { Buffer } from "node:buffer";
import { normalize, sep } from "node:path";

import { describe, test, expect, vi, beforeEach } from "vitest";
import type { IFilesystem } from "@vortex/paths";
import { FileEntry, FileType, ResolvedPath, RelativePath } from "@vortex/paths";

type MockDirent = {
  name: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
};

type MockStat = {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
  size: number;
  mtime: Date;
  birthtime: Date;
  atime: Date;
  mode: number;
};

const fsExtraMocks = vi.hoisted(() => ({
  appendFile:
    vi.fn<
      (
        filePath: string,
        data: string | Uint8Array,
        options?: { encoding: BufferEncoding },
      ) => Promise<void>
    >(),
  copy: vi.fn<
    (
      src: string,
      dest: string,
      options: { overwrite: boolean },
    ) => Promise<void>
  >(),
  ensureDir: vi.fn<(dirPath: string) => Promise<void>>(),
  lstat: vi.fn<(filePath: string) => Promise<MockStat>>(),
  mkdir:
    vi.fn<
      (
        dirPath: string,
        options?: { recursive?: boolean; mode?: number },
      ) => Promise<void>
    >(),
  pathExists: vi.fn<(filePath: string) => Promise<boolean>>(),
  readFile:
    vi.fn<
      (
        filePath: string,
        options?: { encoding: BufferEncoding },
      ) => Promise<string | Buffer>
    >(),
  readdir:
    vi.fn<
      (
        dirPath: string,
        options: { withFileTypes: true },
      ) => Promise<MockDirent[]>
    >(),
  remove: vi.fn<(dirPath: string) => Promise<void>>(),
  rename: vi.fn<(src: string, dest: string) => Promise<void>>(),
  rmdir: vi.fn<(dirPath: string) => Promise<void>>(),
  stat: vi.fn<(filePath: string) => Promise<MockStat>>(),
  unlink: vi.fn<(filePath: string) => Promise<void>>(),
  writeFile:
    vi.fn<
      (
        filePath: string,
        data: string | Uint8Array,
        options?: { encoding: BufferEncoding },
      ) => Promise<void>
    >(),
}));

vi.mock("fs-extra", () => {
  return fsExtraMocks;
});

import { NodeFilesystem } from "./NodeFilesystem";

function makeMockStat(
  opts: Partial<{
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    size: number;
    mtime: Date;
    birthtime: Date;
    atime: Date;
    mode: number;
  }> = {},
): MockStat {
  return {
    isFile: vi.fn(() => opts.isFile ?? false),
    isDirectory: vi.fn(() => opts.isDirectory ?? false),
    isSymbolicLink: vi.fn(() => opts.isSymbolicLink ?? false),
    size: opts.size ?? 0,
    mtime: opts.mtime ?? new Date("2025-01-01"),
    birthtime: opts.birthtime ?? new Date("2025-01-01"),
    atime: opts.atime ?? new Date("2025-01-01"),
    mode: opts.mode ?? 0o644,
  };
}

function makeMockDirent(
  name: string,
  type: "file" | "dir" | "link",
): MockDirent {
  return {
    name,
    isFile: vi.fn(() => type === "file"),
    isDirectory: vi.fn(() => type === "dir"),
    isSymbolicLink: vi.fn(() => type === "link"),
  };
}

describe("NodeFilesystem", () => {
  let nodeFs: NodeFilesystem;

  beforeEach(() => {
    nodeFs = new NodeFilesystem();
    vi.clearAllMocks();
  });

  describe("platform detection", () => {
    test("detects platform from process.platform", () => {
      const expectedPlatform =
        process.platform === "win32" ? ("windows" as const) : ("unix" as const);
      expect(nodeFs.platform).toBe(expectedPlatform);
    });

    test("sets caseSensitive based on platform", () => {
      const expectedSensitive = process.platform !== "win32";
      expect(nodeFs.caseSensitive).toBe(expectedSensitive);
    });

    test("sep matches path.sep", () => {
      expect(nodeFs.sep).toBe(sep);
    });
  });

  describe("normalizePath", () => {
    test("normalizes path using path.normalize", () => {
      const result = nodeFs.normalizePath("/foo//bar/./baz");
      expect(result).toBe(normalize("/foo//bar/./baz"));
    });

    test("lowercases on case-insensitive platforms", () => {
      const normalizedPath = normalize("/Foo/Bar");
      const path = nodeFs.normalizePath("/Foo/Bar");
      if (nodeFs.caseSensitive) {
        expect(path).toBe(normalizedPath);
      } else {
        expect(path).toBe(normalizedPath.toLowerCase());
      }
    });
  });

  describe("readFile", () => {
    test("reads file with encoding", async () => {
      fsExtraMocks.readFile.mockResolvedValue("file content");

      const result = await nodeFs.readFile(
        ResolvedPath.make("/test/file.txt"),
        "utf8",
      );

      expect(result).toBe("file content");
      expect(fsExtraMocks.readFile).toHaveBeenCalledWith("/test/file.txt", {
        encoding: "utf8",
      });
    });

    test("reads file without encoding returns buffer", async () => {
      const buffer = Buffer.from("binary data");
      fsExtraMocks.readFile.mockResolvedValue(buffer);

      const result = await nodeFs.readFile(
        ResolvedPath.make("/test/file.bin"),
        null,
      );

      expect(result).toBe(buffer);
      expect(fsExtraMocks.readFile).toHaveBeenCalledWith("/test/file.bin");
    });
  });

  describe("writeFile", () => {
    test("ensures parent dir and writes file", async () => {
      fsExtraMocks.ensureDir.mockResolvedValue(undefined);
      fsExtraMocks.writeFile.mockResolvedValue(undefined);

      await nodeFs.writeFile(
        ResolvedPath.make("/test/dir/file.txt"),
        "content",
        "utf8",
      );

      expect(fsExtraMocks.ensureDir).toHaveBeenCalledWith("/test/dir");
      expect(fsExtraMocks.writeFile).toHaveBeenCalledWith(
        "/test/dir/file.txt",
        "content",
        { encoding: "utf8" },
      );
    });

    test("writes without encoding option when not provided", async () => {
      fsExtraMocks.ensureDir.mockResolvedValue(undefined);
      fsExtraMocks.writeFile.mockResolvedValue(undefined);

      await nodeFs.writeFile(ResolvedPath.make("/test/file.txt"), "content");

      expect(fsExtraMocks.writeFile).toHaveBeenCalledWith(
        "/test/file.txt",
        "content",
        undefined,
      );
    });
  });

  describe("appendFile", () => {
    test("appends data to file", async () => {
      fsExtraMocks.appendFile.mockResolvedValue(undefined);

      await nodeFs.appendFile(
        ResolvedPath.make("/test/file.txt"),
        "more data",
        "utf8",
      );

      expect(fsExtraMocks.appendFile).toHaveBeenCalledWith(
        "/test/file.txt",
        "more data",
        { encoding: "utf8" },
      );
    });
  });

  describe("unlink", () => {
    test("deletes file", async () => {
      fsExtraMocks.unlink.mockResolvedValue(undefined);

      await nodeFs.unlink(ResolvedPath.make("/test/file.txt"));

      expect(fsExtraMocks.unlink).toHaveBeenCalledWith("/test/file.txt");
    });
  });

  describe("readdir", () => {
    test("returns file entries with correct types", async () => {
      const dirEntries = [
        makeMockDirent("file.txt", "file"),
        makeMockDirent("subdir", "dir"),
      ];
      fsExtraMocks.readdir.mockResolvedValue(dirEntries);

      const fileStat = makeMockStat({ isFile: true, size: 100 });
      const dirStat = makeMockStat({ isDirectory: true, size: 0 });
      fsExtraMocks.stat
        .mockResolvedValueOnce(fileStat)
        .mockResolvedValueOnce(dirStat);

      const results = await nodeFs.readdir(ResolvedPath.make("/test/dir"));

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe(RelativePath.make("file.txt"));
      expect(FileEntry.isFile(results[0])).toBe(true);
      expect(results[1].name).toBe(RelativePath.make("subdir"));
      expect(FileEntry.isDirectory(results[1])).toBe(true);
    });

    test("handles symbolic links", async () => {
      const dirEntries = [makeMockDirent("link", "link")];
      fsExtraMocks.readdir.mockResolvedValue(dirEntries);

      const linkStat = makeMockStat({ isSymbolicLink: true, size: 50 });
      fsExtraMocks.stat.mockResolvedValue(linkStat);

      const results = await nodeFs.readdir(ResolvedPath.make("/test/dir"));

      expect(results).toHaveLength(1);
      expect(FileEntry.isSymbolicLink(results[0])).toBe(true);
    });
  });

  describe("mkdir", () => {
    test("creates directory with options", async () => {
      fsExtraMocks.mkdir.mockResolvedValue(undefined);

      await nodeFs.mkdir(ResolvedPath.make("/test/dir"), {
        recursive: true,
        mode: 0o755,
      });

      expect(fsExtraMocks.mkdir).toHaveBeenCalledWith("/test/dir", {
        recursive: true,
        mode: 0o755,
      });
    });
  });

  describe("rmdir", () => {
    test("uses fs.remove for recursive rmdir", async () => {
      fsExtraMocks.remove.mockResolvedValue(undefined);

      await nodeFs.rmdir(ResolvedPath.make("/test/dir"), { recursive: true });

      expect(fsExtraMocks.remove).toHaveBeenCalledWith("/test/dir");
    });

    test("uses fs.rmdir for non-recursive", async () => {
      fsExtraMocks.rmdir.mockResolvedValue(undefined);

      await nodeFs.rmdir(ResolvedPath.make("/test/dir"));

      expect(fsExtraMocks.rmdir).toHaveBeenCalledWith("/test/dir");
    });
  });

  describe("exists", () => {
    test("returns true when path exists", async () => {
      fsExtraMocks.pathExists.mockResolvedValue(true);

      const result = await nodeFs.exists(ResolvedPath.make("/test/file.txt"));

      expect(result).toBe(true);
      expect(fsExtraMocks.pathExists).toHaveBeenCalledWith("/test/file.txt");
    });

    test("returns false when path does not exist", async () => {
      fsExtraMocks.pathExists.mockResolvedValue(false);

      const result = await nodeFs.exists(ResolvedPath.make("/nonexistent"));

      expect(result).toBe(false);
    });
  });

  describe("stat", () => {
    test("returns file entry for regular file", async () => {
      const fileStat = makeMockStat({ isFile: true, size: 1024, mode: 0o644 });
      fsExtraMocks.stat.mockResolvedValue(fileStat);

      const entry = await nodeFs.stat(ResolvedPath.make("/test/file.txt"));

      expect(FileEntry.isFile(entry)).toBe(true);
      expect(FileEntry.isDirectory(entry)).toBe(false);
      expect(entry.size).toBe(1024);
    });

    test("returns file entry for directory", async () => {
      const dirStat = makeMockStat({ isDirectory: true, size: 0, mode: 0o755 });
      fsExtraMocks.stat.mockResolvedValue(dirStat);

      const entry = await nodeFs.stat(ResolvedPath.make("/test/dir"));

      expect(FileEntry.isDirectory(entry)).toBe(true);
      expect(FileEntry.isFile(entry)).toBe(false);
    });

    test("sets correct type flags for symlink", async () => {
      const linkStat = makeMockStat({
        isFile: true,
        isSymbolicLink: true,
        size: 50,
      });
      fsExtraMocks.stat.mockResolvedValue(linkStat);

      const entry = await nodeFs.stat(ResolvedPath.make("/test/link"));

      expect(FileEntry.isFile(entry)).toBe(true);
      expect(FileEntry.isSymbolicLink(entry)).toBe(true);
      expect(entry.type & FileType.SymbolicLink).not.toBe(0);
    });
  });

  describe("lstat", () => {
    test("returns entry without following symlinks", async () => {
      const linkStat = makeMockStat({
        isSymbolicLink: true,
        isFile: false,
        size: 50,
      });
      fsExtraMocks.lstat.mockResolvedValue(linkStat);

      const entry = await nodeFs.lstat(ResolvedPath.make("/test/link"));

      expect(FileEntry.isSymbolicLink(entry)).toBe(true);
      expect(FileEntry.isFile(entry)).toBe(false);
      expect(fsExtraMocks.lstat).toHaveBeenCalledWith("/test/link");
    });
  });

  describe("copy", () => {
    test("copies file with overwrite option", async () => {
      fsExtraMocks.copy.mockResolvedValue(undefined);

      await nodeFs.copy(
        ResolvedPath.make("/test/src.txt"),
        ResolvedPath.make("/test/dest.txt"),
        { overwrite: true },
      );

      expect(fsExtraMocks.copy).toHaveBeenCalledWith(
        "/test/src.txt",
        "/test/dest.txt",
        { overwrite: true },
      );
    });

    test("defaults overwrite to true", async () => {
      fsExtraMocks.copy.mockResolvedValue(undefined);

      await nodeFs.copy(
        ResolvedPath.make("/test/src.txt"),
        ResolvedPath.make("/test/dest.txt"),
      );

      expect(fsExtraMocks.copy).toHaveBeenCalledWith(
        "/test/src.txt",
        "/test/dest.txt",
        { overwrite: true },
      );
    });
  });

  describe("rename", () => {
    test("renames file", async () => {
      fsExtraMocks.rename.mockResolvedValue(undefined);

      await nodeFs.rename(
        ResolvedPath.make("/test/old.txt"),
        ResolvedPath.make("/test/new.txt"),
      );

      expect(fsExtraMocks.rename).toHaveBeenCalledWith(
        "/test/old.txt",
        "/test/new.txt",
      );
    });
  });

  describe("IFilesystem interface compliance", () => {
    test("implements IFilesystem", () => {
      const fs: IFilesystem = nodeFs;
      expect(fs).toBeDefined();
      expect(typeof fs.readFile).toBe("function");
      expect(typeof fs.writeFile).toBe("function");
      expect(typeof fs.appendFile).toBe("function");
      expect(typeof fs.unlink).toBe("function");
      expect(typeof fs.readdir).toBe("function");
      expect(typeof fs.mkdir).toBe("function");
      expect(typeof fs.rmdir).toBe("function");
      expect(typeof fs.exists).toBe("function");
      expect(typeof fs.stat).toBe("function");
      expect(typeof fs.lstat).toBe("function");
      expect(typeof fs.copy).toBe("function");
      expect(typeof fs.rename).toBe("function");
      expect(typeof fs.normalizePath).toBe("function");
    });
  });
});
