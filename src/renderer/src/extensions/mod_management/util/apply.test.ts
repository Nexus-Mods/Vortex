import * as path from "node:path";

import { KeptReason, type Operation } from "@nexusmods/mod-pipeline";
import { InMemoryFSBuilder, QualifiedPath, type FileSystem } from "@vortex/shared/filesystem";
import { describe, expect, test } from "vitest";

import { startJournal } from "@/test-utils/journal";
import { makeNexusFileSource } from "@/test-utils/lockfileBuilders";
import {
  makeLinkOperation,
  makeRestoreOperation,
  makeUnlinkOperation,
} from "@/test-utils/operationBuilders";
import { makeTempDir } from "@/test-utils/tempDir";

import { BACKUP_TAG } from "../LinkingDeployment";
import {
  apply,
  ApplyStatus,
  RefusalReason,
  resumeApply,
  rollback,
  type ResumeResult,
  type RunOptions,
  type StagedFiles,
} from "./apply/apply";
import { JournalReadStatus, readJournal, type JournalStorage } from "./apply/journal";
import { applyFilesOn } from "./applyFiles";
import { journalStorageAt } from "./journalStorage";

const ROOT = "/fixture-root";
const GAME = `${ROOT}/game`;
const STAGING = `${ROOT}/staging`;
const WORK = `${ROOT}/work`;
const KEPT = `${WORK}/kept`;
const RUN_ID = "fixture-run";

const qualified = (filePath: string) => QualifiedPath.fromNative(filePath);
const inGame = (name: string) => `${GAME}/${name}`;
const inStaging = (name: string) => `${STAGING}/${name}`;
const backupPathOf = (destinationPath: string) => `${destinationPath}${BACKUP_TAG}`;
const backupOf = (name: string) => backupPathOf(inGame(name));
const keptPathOf = (_destinationPath: string, runId: string, entryIndex: number) =>
  `${KEPT}/${runId}/${entryIndex}`;

const fileNamed = (name: string) =>
  makeNexusFileSource({ fileHash: name, destinationPath: inGame(name) });
const restore = (name: string) => makeRestoreOperation({ destinationPath: inGame(name) });
const unlink = (name: string) => makeUnlinkOperation({ file: fileNamed(name) });
const link = (name: string) => makeLinkOperation({ file: fileNamed(name) });

const stagedFiles: StagedFiles = { pathOf: (file) => inStaging(file.fileHash) };

const newJournal = async () =>
  journalStorageAt(path.join(await makeTempDir("apply-journal-"), "journal.ndjson"));

const unreadableJournal = async () => {
  const journal = await newJournal();
  await journal.write(new TextEncoder().encode("{ not json\n"));
  return journal;
};

interface Setup {
  /** files only in staging */
  staged?: string[];
  /** other files, by path, with their contents */
  other?: Record<string, string>;
}

function seed({ staged = [], other = {} }: Setup): FileSystem {
  const builder = new InMemoryFSBuilder().dir(qualified(GAME)).dir(qualified(WORK));
  for (const name of staged) {
    builder.file(qualified(inStaging(name)), { type: "text", data: `staged ${name}` });
  }
  for (const [filePath, data] of Object.entries(other)) {
    builder.file(qualified(filePath), { type: "text", data });
  }
  return builder.build();
}

/** Files as `contents#id`, folders as `folder`. */
async function snapshot(fs: FileSystem): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  const listing = await fs.enumerateDirectory(qualified(ROOT), {
    includeStatus: true,
    recursive: true,
  });
  for await (const [entryPath, status] of listing) {
    if (status.isFile) {
      const contents = new TextDecoder().decode(await fs.readFile(entryPath));
      entries[entryPath.path] = `${contents}#${status.id}`;
    } else {
      entries[entryPath.path] = "folder";
    }
  }
  return entries;
}

const optionsOn = (fs: FileSystem, journal: JournalStorage): RunOptions => ({
  files: applyFilesOn(fs),
  journal,
});

const runApply = (fs: FileSystem, operations: readonly Operation[], journal: JournalStorage) =>
  apply(operations, {
    ...optionsOn(fs, journal),
    backupPathOf,
    keptPathOf,
    stagedFiles,
  });

const journalStatusOf = async (journal: JournalStorage) => (await readJournal(journal)).status;

function expectStatus<S extends ResumeResult["status"]>(
  result: ResumeResult,
  status: S,
): asserts result is Extract<ResumeResult, { status: S }> {
  expect(result.status).toBe(status);
}

describe("apply", () => {
  test("keeps a finished run when its journal can't be removed, for a resume to end", async () => {
    const fs = seed({ staged: ["a.dll"] });
    const journal = await newJournal();
    const failing = { ...journal, remove: () => Promise.reject(new Error("held by a scanner")) };

    const result = await runApply(fs, [link("a.dll")], failing);

    expectStatus(result, ApplyStatus.Unfinished);
    const after = await snapshot(fs);
    expect(after[inGame("a.dll")]).toBe(after[inStaging("a.dll")]);
    expectStatus(await resumeApply(optionsOn(fs, journal)), ApplyStatus.Applied);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  describe("refuses, changing nothing", () => {
    test("a staged path its journal couldn't read back", async () => {
      const fs = seed({ staged: ["a.dll"] });
      const before = await snapshot(fs);
      const journal = await newJournal();

      const result = await apply([link("a.dll")], {
        ...optionsOn(fs, journal),
        backupPathOf,
        keptPathOf,
        stagedFiles: { pathOf: () => "C:\\staging\\a.dll" },
      });

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.InvalidPath);
      expect(await snapshot(fs)).toEqual(before);
      expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
    });

    test("a journal in progress", async () => {
      const fs = seed({ staged: ["a.dll"] });
      const before = await snapshot(fs);
      const journal = await newJournal();
      await (await startJournal(journal, [], RUN_ID)).close();

      const result = await runApply(fs, [link("a.dll")], journal);

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.JournalExists);
      expect(await snapshot(fs)).toEqual(before);
    });

    test("a journal another run started after this one looked", async () => {
      const fs = seed({ staged: ["a.dll"] });
      const before = await snapshot(fs);
      const journal = await newJournal();
      await (await startJournal(journal, [], RUN_ID)).close();
      const lookedTooEarly = { ...journal, read: () => Promise.resolve(undefined) };

      const result = await runApply(fs, [link("a.dll")], lookedTooEarly);

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.JournalExists);
      expect(await snapshot(fs)).toEqual(before);
    });

    test("a journal that can't be read, keeping it", async () => {
      const fs = seed({ staged: ["a.dll"] });
      const journal = await unreadableJournal();

      const result = await runApply(fs, [link("a.dll")], journal);

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.JournalUnavailable);
      expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Invalid);
    });
  });
});

describe.each([
  ["resumeApply", resumeApply],
  ["rollback", rollback],
])("%s", (_name, settle) => {
  test("has nothing to do without a journal", async () => {
    const result = await settle(optionsOn(seed({}), await newJournal()));

    expectStatus(result, ApplyStatus.NothingToDo);
  });

  test("refuses a journal that can't be read, keeping it", async () => {
    const journal = await unreadableJournal();

    const result = await settle(optionsOn(seed({}), journal));

    expectStatus(result, ApplyStatus.Refused);
    expect(result.reason).toBe(RefusalReason.JournalUnavailable);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Invalid);
  });
});

describe("resumeApply", () => {
  test("rolls back when a RESTORE finds its destination occupied", async () => {
    const fs = seed({
      other: { [inGame("a.dll")]: "someone else's", [backupOf("a.dll")]: "original" },
    });
    const before = await snapshot(fs);
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [{ operation: restore("a.dll"), backupPath: backupOf("a.dll") }],
      RUN_ID,
    );
    await writer.close();

    expectStatus(await resumeApply(optionsOn(fs, journal)), ApplyStatus.RolledBack);

    expect(await snapshot(fs)).toEqual(before);
  });

  test.each([
    ["marked done as kept", true],
    ["moved before a kill, not marked", false],
  ])("reports a file an UNLINK kept %s", async (_, markedDone) => {
    const keptPath = keptPathOf(inGame("a.dll"), RUN_ID, 0);
    const fs = seed({ staged: ["a.dll"], other: { [keptPath]: "my edit" } });
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [{ operation: unlink("a.dll"), stagedPath: inStaging("a.dll"), keptPath }],
      RUN_ID,
    );
    if (markedDone) {
      await writer.markDone(0, true);
    }
    await writer.close();

    const result = await resumeApply(optionsOn(fs, journal));

    expectStatus(result, ApplyStatus.Applied);
    expect(result.kept).toEqual([
      { destinationPath: inGame("a.dll"), keptPath, reason: KeptReason.NotOurs },
    ]);
  });

  test("finishes a rollback rather than run it forward", async () => {
    const fs = seed({ staged: ["a.dll"] });
    const before = await snapshot(fs);
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [{ operation: link("a.dll"), stagedPath: inStaging("a.dll") }],
      RUN_ID,
    );
    await writer.startRollback();
    await writer.close();

    expectStatus(await resumeApply(optionsOn(fs, journal)), ApplyStatus.RolledBack);

    expect(await snapshot(fs)).toEqual(before);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });
});

describe("rollback", () => {
  test("leaves a folder the run created when something else is in it", async () => {
    const fs = seed({ other: { [inGame("new/mine.txt")]: "mine" } });
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [{ operation: link("new/a.dll"), stagedPath: inStaging("new/a.dll") }],
      RUN_ID,
    );
    await writer.markChanging(0);
    await writer.recordFolder(0, inGame("new"));
    await writer.close();

    expectStatus(await rollback(optionsOn(fs, journal)), ApplyStatus.RolledBack);

    expect(await snapshot(fs)).toHaveProperty([inGame("new/mine.txt")]);
  });

  test("fails and keeps the journal when a LINK's destination is no longer ours", async () => {
    const fs = seed({ staged: ["a.dll"], other: { [inGame("a.dll")]: "someone else's" } });
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [{ operation: link("a.dll"), stagedPath: inStaging("a.dll") }],
      RUN_ID,
    );
    await writer.markChanging(0);
    await writer.markDone(0);
    await writer.close();

    const result = await rollback(optionsOn(fs, journal));

    expectStatus(result, ApplyStatus.RollbackFailed);
    expect(result.rollbackFailedAt).toMatchObject({ index: 0 });
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Found);
  });
});
