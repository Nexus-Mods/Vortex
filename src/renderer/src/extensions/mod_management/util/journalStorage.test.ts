import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  createJournal,
  JournalOperationKind,
  JournalReadStatus,
  openJournal,
  readJournal,
} from "@nexusmods/mod-pipeline";
import { beforeEach, describe, expect, it } from "vitest";

import { makeTempDir } from "@/test-utils/tempDir";

import { journalStorageAt } from "./journalStorage";

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | undefined) =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes);

describe("journalStorageAt", () => {
  let journalFile: string;

  beforeEach(async () => {
    journalFile = path.join(await makeTempDir("journal-storage-"), "work", "journal.ndjson");
  });

  it("reads nothing when there is no journal", async () => {
    expect(await journalStorageAt(journalFile).read()).toBeUndefined();
  });

  it("replaces a journal it is appending to", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.write(encode("one\n"));
    await storage.append(encode("two\n"));

    await storage.write(encode("three\n"));
    await storage.append(encode("four\n"));
    await storage.close();

    expect(decode(await storage.read())).toBe("three\nfour\n");
  });

  it("appends to what another run wrote", async () => {
    const earlier = journalStorageAt(journalFile);
    await earlier.write(encode("one\n"));
    await earlier.append(encode("two\n"));
    await earlier.close();

    const storage = journalStorageAt(journalFile);
    await storage.append(encode("three\n"));
    await storage.close();

    expect(decode(await storage.read())).toBe("one\ntwo\nthree\n");
  });

  it("ignores a temporary file a kill left behind", async () => {
    await fs.mkdir(path.dirname(journalFile));
    await fs.writeFile(`${journalFile}.tmp`, "part of a jour");
    const storage = journalStorageAt(journalFile);

    expect(await storage.read()).toBeUndefined();

    await storage.write(encode("one\n"));

    expect(decode(await storage.read())).toBe("one\n");
  });

  it("removes the journal", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.write(encode("one\n"));
    await storage.append(encode("two\n"));
    await storage.close();

    await storage.remove();

    expect(await fs.readdir(path.dirname(journalFile))).toEqual([]);
  });

  it("removes nothing when there is no journal", async () => {
    await expect(journalStorageAt(journalFile).remove()).resolves.toBeUndefined();
  });

  it("carries a journal through a torn last line", async () => {
    const entries = [
      { operation: { kind: JournalOperationKind.Restore, destinationPath: "/game/a.dll" } },
      { operation: { kind: JournalOperationKind.Restore, destinationPath: "/game/b.dll" } },
    ];
    const killed = await createJournal(journalStorageAt(journalFile), entries);
    await killed.markDone(0);
    await killed.close();
    await fs.appendFile(journalFile, '{"type":"done","ind');

    const storage = journalStorageAt(journalFile);
    const writer = await openJournal(storage);
    await writer.markDone(1);
    await writer.close();

    expect(await readJournal(storage)).toMatchObject({
      status: JournalReadStatus.Found,
      journal: { runId: killed.runId, done: new Set([0, 1]) },
    });
  });
});
