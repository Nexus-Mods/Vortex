import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DestinationState,
  FileSourceKind,
  HashType,
  NexusFileId,
  OperationKind,
  type FileSource,
} from "@nexusmods/mod-pipeline";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { journalStorageAt } from "../journalStorage";
import {
  createJournal,
  JournalPhase,
  JournalReadStatus,
  openJournal,
  readJournal,
  type JournalEntry,
  type JournalStorage,
} from "./journal";

const RUN_ID = "fixture-run";

let root: string;
let workDir: string;
let journalFile: string;
let storage: JournalStorage;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "journal-"));
  workDir = join(root, "work");
  journalFile = join(workDir, "journal.ndjson");
  storage = journalStorageAt(journalFile);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function makeFileSource(name: string): FileSource {
  return {
    source: FileSourceKind.Nexus,
    nexusFileId: NexusFileId("7318624307791"),
    fileHash: `${name}-hash`,
    hashType: HashType.Md5,
    destinationPath: `/fixture-root/game/${name}`,
  };
}

const makeEntries = (): JournalEntry[] => [
  {
    operation: {
      kind: OperationKind.Backup,
      destinationPath: "/fixture-root/game/plugin.dll",
      reason: DestinationState.NewOverOther,
    },
  },
  {
    operation: {
      kind: OperationKind.Link,
      file: makeFileSource("plugin.dll"),
      reason: DestinationState.NewOverOther,
    },
    stagedPath: "/fixture-root/staging/mod/plugin.dll",
  },
  {
    operation: {
      kind: OperationKind.Restore,
      destinationPath: "/fixture-root/game/old.dll",
      reason: DestinationState.Removed,
    },
  },
];

/** Starts a run's journal on storage that has none. */
async function startJournal(entries = makeEntries(), runId = RUN_ID) {
  const writer = await createJournal(storage, entries, runId);
  if (writer === undefined) {
    throw new Error("a journal was already there");
  }
  return writer;
}

const foundJournal = async () => {
  const read = await readJournal(storage);
  if (read.status !== JournalReadStatus.Found) {
    throw new Error(`no journal: ${read.status}`);
  }
  return read.journal;
};

describe("readJournal", () => {
  test("finds nothing when no journal was written", async () => {
    expect(await readJournal(storage)).toEqual({ status: JournalReadStatus.None });
  });

  test("reads back the entries of a new journal, with nothing done", async () => {
    const entries = makeEntries();

    const writer = await startJournal(entries);
    await writer.close();

    expect(await foundJournal()).toEqual({
      runId: writer.runId,
      entries,
      phase: JournalPhase.Applying,
      changing: new Set(),
      done: new Set(),
      kept: new Set(),
      undone: new Set(),
      createdFolders: [],
      removedFolders: new Set(),
    });
  });

  test("reads back what a run recorded, without it being closed", async () => {
    const writer = await startJournal();

    await writer.markDone(0);
    await writer.markChanging(1);
    await writer.recordFolder(1, "/fixture-root/game/sub");
    await writer.recordRemovedFolder(1);
    await writer.markDone(1);
    await writer.markChanging(2);
    await writer.markDone(2, true);

    expect(await foundJournal()).toMatchObject({
      phase: JournalPhase.Applying,
      changing: new Set([1, 2]),
      done: new Set([0, 1, 2]),
      kept: new Set([2]),
      createdFolders: [{ index: 1, path: "/fixture-root/game/sub" }],
      removedFolders: new Set([1]),
    });
    await writer.close();
  });

  test("reads back a rollback's progress", async () => {
    const writer = await startJournal();
    await writer.markDone(0);
    await writer.markDone(1);

    await writer.startRollback();
    await writer.markUndone(1);
    await writer.close();

    expect(await foundJournal()).toMatchObject({
      phase: JournalPhase.RollingBack,
      done: new Set([0, 1]),
      undone: new Set([1]),
    });
  });

  test("ignores a torn last line and leaves it in the file", async () => {
    const writer = await startJournal();
    await writer.markDone(0);
    await writer.close();
    await fs.appendFile(journalFile, '{"type":"done","ind');
    const before = await fs.readFile(journalFile, "utf8");

    expect((await foundJournal()).done).toEqual(new Set([0]));
    expect(await fs.readFile(journalFile, "utf8")).toBe(before);
  });

  const header = JSON.stringify({ type: "header", version: 1, runId: "run", count: 0 });

  test.each([
    ["is empty", ""],
    ["is not JSON", "{ not json\n"],
    ["has an unknown version", `${JSON.stringify({ type: "header", version: 2 })}\n`],
    [
      "has fewer entries than its header says",
      `${JSON.stringify({ type: "header", version: 1, runId: "run", count: 1 })}\n`,
    ],
    [
      "has a relative path",
      [
        JSON.stringify({ type: "header", version: 1, runId: "run", count: 1 }),
        JSON.stringify({
          operation: {
            kind: OperationKind.Restore,
            destinationPath: "game/a",
            reason: DestinationState.Removed,
          },
        }),
        "",
      ].join("\n"),
    ],
    [
      "marks an entry it doesn't have",
      [header, JSON.stringify({ type: "done", index: 0 }), ""].join("\n"),
    ],
    [
      "is corrupt before its last line",
      [
        header,
        "{ not json",
        JSON.stringify({ type: "phase", phase: JournalPhase.RollingBack }),
        "",
      ].join("\n"),
    ],
  ])("refuses a journal that %s, and keeps it", async (_name, contents) => {
    await fs.mkdir(workDir);
    await fs.writeFile(journalFile, contents);

    expect(await readJournal(storage)).toEqual({ status: JournalReadStatus.Invalid });
    expect(await fs.readFile(journalFile, "utf8")).toBe(contents);
  });

  test("reads a journal the size of a large setup", { timeout: 60_000 }, async () => {
    const count = 223_000;
    const entries = Array.from(
      { length: count },
      (_, index): JournalEntry => ({
        operation: {
          kind: OperationKind.Link,
          file: makeFileSource(`textures/file_${index}.dds`),
          reason: DestinationState.NewFile,
        },
        stagedPath: `/fixture-root/staging/mod/textures/file_${index}.dds`,
      }),
    );

    const writer = await startJournal(entries);
    await writer.close();
    await fs.appendFile(
      journalFile,
      entries.map((_, index) => `${JSON.stringify({ type: "done", index })}\n`).join(""),
    );

    const journal = await foundJournal();
    expect(journal.entries).toHaveLength(count);
    expect(journal.done.size).toBe(count);
  });
});

describe("createJournal", () => {
  test("refuses to replace a journal in progress", async () => {
    const writer = await startJournal();
    await writer.close();

    expect(await createJournal(storage, [], "second-run")).toBeUndefined();

    expect((await foundJournal()).runId).toBe(writer.runId);
  });

  test("lets only one of two overlapping runs start", async () => {
    const started = await Promise.all([
      createJournal(storage, makeEntries(), "first-run"),
      createJournal(journalStorageAt(journalFile), makeEntries(), "second-run"),
    ]);

    const writers = started.filter((writer) => writer !== undefined);
    await Promise.all(writers.map((writer) => writer.close()));

    expect(writers).toHaveLength(1);
    expect((await foundJournal()).runId).toBe(writers[0]?.runId);
  });
});

describe("openJournal", () => {
  test("continues a journal whose writer never closed", async () => {
    const killed = await startJournal();
    await killed.markDone(0);

    const writer = await openJournal(journalStorageAt(journalFile));
    await writer.markDone(1);
    await writer.close();
    await killed.close();

    expect(writer.runId).toBe(killed.runId);
    expect((await foundJournal()).done).toEqual(new Set([0, 1]));
  });

  test("removes a torn last line before appending", async () => {
    const earlier = await startJournal();
    await earlier.markDone(0);
    await earlier.close();
    await fs.appendFile(journalFile, '{"type":"done","ind');

    const writer = await openJournal(storage);
    await writer.markDone(1);
    await writer.close();

    expect((await foundJournal()).done).toEqual(new Set([0, 1]));
  });

  test("refuses a journal it can't read, and keeps it", async () => {
    await fs.mkdir(workDir);
    await fs.writeFile(journalFile, "{ not json\n");

    await expect(openJournal(storage)).rejects.toThrow("can't be read");

    expect(await fs.readFile(journalFile, "utf8")).toBe("{ not json\n");
  });
});

describe("JournalWriter.finish", () => {
  test("ends the run, leaving no journal", async () => {
    const writer = await startJournal();
    await writer.markDone(0);

    await writer.finish();

    expect(await fs.readdir(workDir)).toEqual([]);
    expect(await readJournal(storage)).toEqual({ status: JournalReadStatus.None });
  });
});
