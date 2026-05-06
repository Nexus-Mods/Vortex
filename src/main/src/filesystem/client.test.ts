import type { Status } from "@nexusmods/adaptor-api/fs";
import { FileSystemError, QualifiedPath } from "@nexusmods/adaptor-api/fs";
import { describe, expect, it, vi } from "vitest";

import type { FileSystemSendFn } from "./client";
import { createFileSystemClient } from "./client";

const ROOT = QualifiedPath.parse("linux:///tmp/fs-client-test");
const FILE = ROOT.join("hello.txt");

function makeSend(
  responses: Record<string, (args: readonly unknown[]) => unknown>,
): FileSystemSendFn {
  return vi.fn((method: string, args: readonly unknown[]) => {
    const impl = responses[method];
    if (!impl) return Promise.reject(new Error(`unexpected method: ${method}`));
    return Promise.resolve(impl(args));
  });
}

describe("createFileSystemClient", () => {
  describe("flat methods", () => {
    it("forwards readFile args and returns the bytes", async () => {
      const send = makeSend({
        readFile: () => new Uint8Array([1, 2, 3]),
      });
      const fs = createFileSystemClient(send);

      const bytes = await fs.readFile(FILE);

      expect(send).toHaveBeenCalledWith("readFile", [FILE]);
      expect(Array.from(bytes)).toEqual([1, 2, 3]);
    });

    it("forwards writeFile args", async () => {
      const send = makeSend({ writeFile: () => undefined });
      const fs = createFileSystemClient(send);

      await fs.writeFile(FILE, new Uint8Array([9]));

      expect(send).toHaveBeenCalledWith("writeFile", [FILE, new Uint8Array([9])]);
    });

    it.each([
      ["createDirectory", "createDirectory" as const],
      ["delete", "delete" as const],
      ["deleteRecursive", "deleteRecursive" as const],
    ])("forwards %s", async (_, method) => {
      const send = makeSend({ [method]: () => undefined });
      const fs = createFileSystemClient(send);
      await fs[method](FILE);
      expect(send).toHaveBeenCalledWith(method, [FILE]);
    });

    it("forwards copy and move with options", async () => {
      const send = makeSend({ copy: () => undefined, move: () => undefined });
      const fs = createFileSystemClient(send);

      await fs.copy(FILE, FILE, { overwrite: true });
      await fs.move(FILE, FILE, { overwrite: false });

      expect(send).toHaveBeenCalledWith("copy", [FILE, FILE, { overwrite: true }]);
      expect(send).toHaveBeenCalledWith("move", [FILE, FILE, { overwrite: false }]);
    });

    it("forwards stat options and returns the result", async () => {
      const statResult = { exists: false } as const;
      const send = makeSend({ stat: () => statResult });
      const fs = createFileSystemClient(send);

      const res = await fs.stat(FILE, { parseSymLink: true });

      expect(send).toHaveBeenCalledWith("stat", [FILE, { parseSymLink: true }]);
      expect(res).toEqual(statResult);
    });
  });

  describe("error rehydration", () => {
    it("rehydrates FileSystemError with code and isTransient", async () => {
      const send: FileSystemSendFn = () => {
        // Simulate what the transport produces on the receiving end:
        // a generic Error whose name/code/isTransient have been copied
        // back onto the prototype by the structured envelope.
        const err = new Error("Failed to read file '/x': file does not exist");
        err.name = "FileSystemError";
        Object.assign(err, { code: "not found", isTransient: false });
        return Promise.reject(err);
      };
      const fs = createFileSystemClient(send);

      await expect(fs.readFile(FILE)).rejects.toMatchObject({
        name: "FileSystemError",
        code: "not found",
        isTransient: false,
      });
      await expect(fs.readFile(FILE)).rejects.toBeInstanceOf(FileSystemError);
    });

    it("passes through non-FileSystemError errors unchanged", async () => {
      const sentinel = new Error("unexpected");
      const send: FileSystemSendFn = () => Promise.reject(sentinel);
      const fs = createFileSystemClient(send);

      await expect(fs.readFile(FILE)).rejects.toBe(sentinel);
    });
  });

  describe("enumerateDirectory", () => {
    it("iterates across multiple batches and terminates on done", async () => {
      // First batch: two entries; second batch: one entry, done.
      const responses = {
        enumerateOpen: () => ({
          cursorId: "fs-cur:1",
          batch: [
            { value: "linux:///tmp/fs-client-test//a" },
            { value: "linux:///tmp/fs-client-test//b" },
          ],
          done: false,
        }),
        enumerateNext: () => ({
          batch: [{ value: "linux:///tmp/fs-client-test//c" }],
          done: true,
        }),
      };
      const send = makeSend(responses);
      const fs = createFileSystemClient(send);

      const iterator = await fs.enumerateDirectory(ROOT);
      const out: string[] = [];
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const qp = next.value;
        if (qp instanceof QualifiedPath) {
          out.push(qp.value);
        }
      }

      expect(out).toEqual([
        "linux:///tmp/fs-client-test//a",
        "linux:///tmp/fs-client-test//b",
        "linux:///tmp/fs-client-test//c",
      ]);
      expect(send).toHaveBeenCalledWith("enumerateOpen", [ROOT, undefined]);
      expect(send).toHaveBeenCalledWith("enumerateNext", ["fs-cur:1"]);
    });

    it("rehydrates [QualifiedPath, Status] tuples when includeStatus is set", async () => {
      const status: Status = {
        isFile: true,
        size: 10,
        id: 0n,
        deviceId: 0n,
        hardlinkCount: 1,
        accessTime: 0n,
        modifiedTime: 0n,
        changeTime: 0n,
        creationTime: 0n,
        isSymLink: false,
      };
      const responses = {
        enumerateOpen: () => ({
          cursorId: "fs-cur:42",
          batch: [[{ value: "linux:///tmp/fs-client-test//x" }, status]],
          done: true,
        }),
      };
      const send = makeSend(responses);
      const fs = createFileSystemClient(send);

      const iterator = await fs.enumerateDirectory(ROOT, {
        includeStatus: true,
      });
      const first = await iterator.next();
      expect(first.done).toBe(false);
      const [qp, s] = first.value as [QualifiedPath, Status];
      expect(qp).toBeInstanceOf(QualifiedPath);
      expect(qp.value).toBe("linux:///tmp/fs-client-test//x");
      expect(s).toEqual(status);
    });

    it("calls enumerateClose when the consumer bails early via return()", async () => {
      const responses = {
        enumerateOpen: () => ({
          cursorId: "fs-cur:7",
          batch: [{ value: "linux:///tmp/fs-client-test//a" }],
          done: false,
        }),
        enumerateClose: () => undefined,
      };
      const send = makeSend(responses);
      const fs = createFileSystemClient(send);

      const iterator = await fs.enumerateDirectory(ROOT);
      await iterator.next();
      await iterator.return?.(undefined);

      expect(send).toHaveBeenCalledWith("enumerateClose", ["fs-cur:7"]);
    });

    it("does not call enumerateClose when iteration naturally completes", async () => {
      const responses = {
        enumerateOpen: () => ({
          cursorId: "fs-cur:3",
          batch: [{ value: "linux:///tmp/fs-client-test//only" }],
          done: true,
        }),
        enumerateClose: () => undefined,
      };
      const send = makeSend(responses);
      const fs = createFileSystemClient(send);

      const iterator = await fs.enumerateDirectory(ROOT);
      await iterator.next();
      const end = await iterator.next();
      expect(end.done).toBe(true);

      const calls = vi.mocked(send).mock.calls.map((c) => c[0]);
      expect(calls).not.toContain("enumerateClose");
    });
  });
});
