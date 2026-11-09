import {
  InMemoryFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type StatResult,
} from "@vortex/shared/filesystem";
import { describe, expect, test } from "vitest";

import { applyFilesOn } from "./applyFiles";

const qualified = (path: string) => QualifiedPath.fromNative(path);

const filesWith = (...paths: string[]) => {
  const builder = new InMemoryFSBuilder();
  for (const path of paths) {
    builder.file(qualified(path), { type: "text", data: path });
  }
  return applyFilesOn(builder.build());
};

describe("applyFilesOn", () => {
  test("gives hardlinks of one file one id, and other files another", async () => {
    const files = filesWith("/a", "/b");

    await files.link("/a", "/link");

    expect(await files.idAt("/link")).toBe(await files.idAt("/a"));
    expect(await files.idAt("/b")).not.toBe(await files.idAt("/a"));
  });

  test("won't move or link over a file", async () => {
    const files = filesWith("/a", "/taken");
    const takenId = await files.idAt("/taken");

    await expect(files.move("/a", "/taken")).rejects.toThrow();
    await expect(files.link("/a", "/taken")).rejects.toThrow();

    expect(await files.idAt("/taken")).toBe(takenId);
    expect(await files.idAt("/a")).toBeDefined();
  });

  test("won't move a file to another drive", async () => {
    class TwoDrivesFS extends InMemoryFS {
      override async stat(
        path: QualifiedPath,
        options?: { parseSymLink: boolean },
      ): Promise<StatResult> {
        const status = await super.stat(path, options);
        return status.exists && path.path.startsWith("/other")
          ? { ...status, deviceId: status.deviceId + 1n }
          : status;
      }
    }
    const seeded = new InMemoryFSBuilder()
      .file(qualified("/game/a"), { type: "text", data: "a" })
      .dir(qualified("/other"));
    const files = applyFilesOn(new TwoDrivesFS(seeded.store));

    await expect(files.move("/game/a", "/other/a")).rejects.toThrow("another drive");

    expect(await files.idAt("/game/a")).toBeDefined();
    expect(await files.idAt("/other/a")).toBeUndefined();
  });

  test("creates a folder and those above it, and again without failing", async () => {
    const files = filesWith();

    await files.createFolder("/one/two");
    await files.createFolder("/one/two");

    expect(await files.idAt("/one/two")).toBeDefined();
  });

  test("leaves a folder with something in it", async () => {
    const files = filesWith("/full/a");

    await files.removeEmptyFolder("/full");

    expect(await files.idAt("/full/a")).toBeDefined();
  });

  test("leaves a file at a folder's path", async () => {
    const files = filesWith("/a");

    await files.removeEmptyFolder("/a");

    expect(await files.idAt("/a")).toBeDefined();
  });

  test("ignores a folder that isn't there", async () => {
    await expect(filesWith().removeEmptyFolder("/missing")).resolves.toBeUndefined();
  });
});
