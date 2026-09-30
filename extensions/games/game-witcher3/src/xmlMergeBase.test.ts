import { describe, expect, it } from "vitest";

import { readMergeBase } from "./xmlMergeBase";

const MERGED = "merged/graphics.xml";
const BACKUP = "game/graphics.xml.vortex_backup";
const GAME = "game/graphics.xml";

const fsError = (code: string) => Object.assign(new Error(code), { code });

function files(present: Record<string, string>) {
  // key: file path
  return {
    exists: async (filePath: string) => filePath in present,
    read: async (filePath: string) => {
      if (!(filePath in present)) {
        throw fsError("ENOENT");
      }
      return Buffer.from(present[filePath]);
    },
  };
}

describe("readMergeBase", () => {
  it("builds on the first copy that exists", async () => {
    const { exists, read } = files({ [BACKUP]: "backup", [GAME]: "game" });

    const result = await readMergeBase([MERGED, BACKUP, GAME], exists, read);

    expect(result?.toString()).toBe("backup");
  });

  it("returns nothing when the game has no copy of the file", async () => {
    const { exists, read } = files({});

    await expect(readMergeBase([MERGED, BACKUP, GAME], exists, read)).resolves.toBeUndefined();
  });

  it("returns nothing when the file disappears between the check and the read", async () => {
    const read = async (): Promise<Buffer> => {
      throw fsError("ENOENT");
    };

    await expect(readMergeBase([GAME], async () => true, read)).resolves.toBeUndefined();
  });

  it("still fails on errors other than the file being missing", async () => {
    const read = async (): Promise<Buffer> => {
      throw fsError("EBUSY");
    };

    await expect(readMergeBase([GAME], async () => true, read)).rejects.toThrow("EBUSY");
  });
});
