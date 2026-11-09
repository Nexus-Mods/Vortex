import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  JournalReadStatus,
  OperationKind,
  openJournal,
  readJournal,
} from "@nexusmods/mod-pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

// the real disk, with rm and open able to fail in a way no file handle can cause on Windows
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  const rm = vi.fn(actual.rm);
  const open = vi.fn(actual.open);
  return { ...actual, default: { ...actual, rm, open }, rm, open };
});

import { startJournal } from "@/test-utils/journal";
import { makeTempDir } from "@/test-utils/tempDir";
import { delayed } from "@/util/util";

import { journalStorageAt } from "./journalStorage";

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | undefined) =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes);
const busy = () => Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });

describe("journalStorageAt", () => {
  let journalFile: string;

  beforeEach(async () => {
    journalFile = path.join(await makeTempDir("journal-storage-"), "work", "journal.ndjson");
  });

  it("reads nothing when there is no journal", async () => {
    expect(await journalStorageAt(journalFile).read()).toBeUndefined();
  });

  it("keeps the journal it finds when creating one", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.create(encode("one\n"));

    expect(await storage.create(encode("two\n"))).toBe(false);

    expect(decode(await storage.read())).toBe("one\n");
  });

  it("creates the journal when its temporary file can't be cleaned up", async () => {
    vi.mocked(fs.rm).mockRejectedValueOnce(busy());
    const storage = journalStorageAt(journalFile);

    expect(await storage.create(encode("one\n"))).toBe(true);

    expect(decode(await storage.read())).toBe("one\n");
  });

  it("removes the journal once another process lets go of it", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.write(encode("one\n"));
    vi.mocked(fs.rm).mockRejectedValueOnce(busy());

    await storage.remove();

    expect(await storage.read()).toBeUndefined();
  });

  it("appends once another process lets go of the journal", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.write(encode("one\n"));
    vi.mocked(fs.open).mockRejectedValueOnce(busy());

    await storage.append(encode("two\n"));
    await storage.close();

    expect(decode(await storage.read())).toBe("one\ntwo\n");
  });

  it("lets one of two overlapping creates win, leaving only the journal", async () => {
    const created = await Promise.all(
      ["one\n", "two\n"].map(async (text) => ({
        text,
        won: await journalStorageAt(journalFile).create(encode(text)),
      })),
    );

    const winners = created.filter(({ won }) => won);
    expect(winners).toHaveLength(1);
    expect(decode(await journalStorageAt(journalFile).read())).toBe(winners[0]?.text);
    expect(await fs.readdir(path.dirname(journalFile))).toEqual([path.basename(journalFile)]);
  });

  it("keeps one handle through overlapping appends", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.create(encode("one\n"));

    await Promise.all([storage.append(encode("two\n")), storage.append(encode("three\n"))]);
    await storage.close();

    // a handle still open would make Windows refuse this
    await storage.write(encode("four\n"));
    expect(decode(await storage.read())).toBe("four\n");
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

  it("replaces the journal once another process lets go of it", async () => {
    const storage = journalStorageAt(journalFile);
    await storage.write(encode("one\n"));
    const scanner = await fs.open(journalFile, "r");
    const released = delayed(150).then(() => scanner.close());

    await storage.write(encode("two\n"));
    await released;

    expect(decode(await storage.read())).toBe("two\n");
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
      { operation: { kind: OperationKind.Restore, destinationPath: "/game/a.dll" } },
      { operation: { kind: OperationKind.Restore, destinationPath: "/game/b.dll" } },
    ];
    const killed = await startJournal(journalStorageAt(journalFile), entries, "fixture-run");
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
