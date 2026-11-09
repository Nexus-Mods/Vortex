import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import {
  apply,
  ApplyStatus,
  createJournal,
  JournalReadStatus,
  OperationKind,
  readJournal,
  RefusalReason,
  resumeApply,
  rollback,
  type JournalStorage,
  type Operation,
  type ResumeResult,
  type RunOptions,
  type StagedFiles,
} from "@nexusmods/mod-pipeline";
import {
  ChaosFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type FileSystem,
} from "@vortex/shared/filesystem";
import { describe, expect, test } from "vitest";

import { makeGeneratedFileSource, makeNexusFileSource } from "@/test-utils/lockfileBuilders";
import {
  makeBackupOperation,
  makeLinkOperation,
  makeUnlinkOperation,
} from "@/test-utils/operationBuilders";
import { makeTempDir } from "@/test-utils/tempDir";

import { BACKUP_TAG } from "../LinkingDeployment";
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
const unlinkKeptPathOf = (_destinationPath: string, runId: string, entryIndex: number) =>
  `${KEPT}/${runId}/${entryIndex}`;

const fileNamed = (name: string) =>
  makeNexusFileSource({ fileHash: name, destinationPath: inGame(name) });
const backup = (name: string) => makeBackupOperation({ destinationPath: inGame(name) });
const unlink = (name: string) => makeUnlinkOperation({ file: fileNamed(name) });
const link = (name: string) => makeLinkOperation({ file: fileNamed(name) });
/**
 * A LINK from another staged folder, as a path can't be both a file and a folder there. The file
 * name stays the same: InMemoryFS lists a hardlink under its first name.
 */
const linkFrom = (stagedName: string, name: string) =>
  makeLinkOperation({
    file: makeNexusFileSource({ fileHash: stagedName, destinationPath: inGame(name) }),
  });

const UNSTAGED = "unstaged.dll";

const stagedFiles: StagedFiles = {
  pathOf: (file) => (file.fileHash === UNSTAGED ? undefined : inStaging(file.fileHash)),
};

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
  /** files in staging with a hardlink at their destination */
  deployed?: string[];
  /** other files, by path, with their contents */
  other?: Record<string, string>;
}

async function seed({ staged = [], deployed = [], other = {} }: Setup): Promise<FileSystem> {
  const builder = new InMemoryFSBuilder().dir(qualified(GAME)).dir(qualified(WORK));
  for (const name of [...staged, ...deployed]) {
    builder.file(qualified(inStaging(name)), { type: "text", data: `staged ${name}` });
  }
  for (const name of deployed) {
    builder.dir(qualified(inGame(name)).parent());
  }
  for (const [filePath, data] of Object.entries(other)) {
    builder.file(qualified(filePath), { type: "text", data });
  }
  const fs = builder.build();
  await Promise.all(
    deployed.map((name) =>
      fs.createLink(qualified(inStaging(name)), qualified(inGame(name)), "hardlink"),
    ),
  );
  return fs;
}

/** Files as `contents#id`, folders as `folder`. A kept file's run id is dropped. */
async function snapshot(fs: FileSystem): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  const listing = await fs.enumerateDirectory(qualified(ROOT), {
    includeStatus: true,
    recursive: true,
  });
  for await (const [entryPath, status] of listing) {
    const name = entryPath.path.replace(/\/kept\/[^/]+/, "/kept/run");
    if (status.isFile) {
      const contents = new TextDecoder().decode(await fs.readFile(entryPath));
      entries[name] = `${contents}#${status.id}`;
    } else {
      entries[name] = "folder";
    }
  }
  return entries;
}

const optionsOn = (fs: FileSystem, journal: JournalStorage): RunOptions => ({
  files: applyFilesOn(fs),
  journal,
});

const runApply = async (
  fs: FileSystem,
  operations: readonly Operation[],
  journal?: JournalStorage,
) =>
  apply(operations, {
    ...optionsOn(fs, journal ?? (await newJournal())),
    backupPathOf,
    unlinkKeptPathOf,
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
  describe("BACKUP", () => {
    test("moves what is at the destination to its backup name", async () => {
      const fs = await seed({ other: { [inGame("a.dll")]: "game file" } });
      const before = await snapshot(fs);

      expectStatus(await runApply(fs, [backup("a.dll")]), ApplyStatus.Applied);

      const after = await snapshot(fs);
      expect(after[backupOf("a.dll")]).toBe(before[inGame("a.dll")]);
      expect(after).not.toHaveProperty([inGame("a.dll")]);
    });

    test("counts as done with nothing at the destination", async () => {
      const fs = await seed({});

      expectStatus(await runApply(fs, [backup("a.dll")]), ApplyStatus.Applied);

      expect(await snapshot(fs)).not.toHaveProperty([backupOf("a.dll")]);
    });
  });

  describe("UNLINK", () => {
    test("deletes a destination with the staged file's id", async () => {
      const fs = await seed({ deployed: ["a.dll"] });

      const result = await runApply(fs, [unlink("a.dll")]);

      expectStatus(result, ApplyStatus.Applied);
      expect(result.kept).toEqual([]);
      const after = await snapshot(fs);
      expect(after).not.toHaveProperty([inGame("a.dll")]);
      expect(after).toHaveProperty([inStaging("a.dll")]);
    });

    test("keeps a destination with another id, and reports it", async () => {
      const fs = await seed({ staged: ["a.dll"], other: { [inGame("a.dll")]: "my edit" } });
      const before = await snapshot(fs);

      const result = await runApply(fs, [unlink("a.dll")]);

      expectStatus(result, ApplyStatus.Applied);
      expect(result.kept.map(({ destinationPath }) => destinationPath)).toEqual([inGame("a.dll")]);
      const after = await snapshot(fs);
      expect(after[`${KEPT}/run/0`]).toBe(before[inGame("a.dll")]);
      expect(after).not.toHaveProperty([inGame("a.dll")]);
    });

    test("keeps a destination with no staged file", async () => {
      const fs = await seed({ other: { [inGame(UNSTAGED)]: "my edit" } });

      const result = await runApply(fs, [unlink(UNSTAGED)]);

      expectStatus(result, ApplyStatus.Applied);
      expect(result.kept).toHaveLength(1);
    });

    test("counts as done with nothing at the destination", async () => {
      const fs = await seed({ staged: ["a.dll"] });

      const result = await runApply(fs, [unlink("a.dll")]);

      expectStatus(result, ApplyStatus.Applied);
      expect(result.kept).toEqual([]);
    });

    test("restores a backup when no LINK fills the destination", async () => {
      const fs = await seed({ deployed: ["a.dll"], other: { [backupOf("a.dll")]: "original" } });
      const before = await snapshot(fs);

      expectStatus(await runApply(fs, [unlink("a.dll")]), ApplyStatus.Applied);

      const after = await snapshot(fs);
      expect(after[inGame("a.dll")]).toBe(before[backupOf("a.dll")]);
      expect(after).not.toHaveProperty([backupOf("a.dll")]);
    });

    test("leaves a backup when a LINK fills the destination", async () => {
      const fs = await seed({ deployed: ["a.dll"], other: { [backupOf("a.dll")]: "original" } });
      const before = await snapshot(fs);

      expectStatus(await runApply(fs, [unlink("a.dll"), link("a.dll")]), ApplyStatus.Applied);

      expect((await snapshot(fs))[backupOf("a.dll")]).toBe(before[backupOf("a.dll")]);
    });
  });

  describe("LINK", () => {
    test("links the staged file, creating the folders it needs", async () => {
      const fs = await seed({ staged: ["sub/folder/a.dll"] });

      expectStatus(await runApply(fs, [link("sub/folder/a.dll")]), ApplyStatus.Applied);

      const after = await snapshot(fs);
      expect(after[inGame("sub/folder/a.dll")]).toBe(after[inStaging("sub/folder/a.dll")]);
    });

    test("counts as done when the destination is already the staged file", async () => {
      const fs = await seed({ deployed: ["a.dll"] });
      const before = await snapshot(fs);

      expectStatus(await runApply(fs, [link("a.dll")]), ApplyStatus.Applied);

      expect(await snapshot(fs)).toEqual(before);
    });

    test("rolls back rather than overwrite anything else", async () => {
      const fs = await seed({
        staged: ["a.dll", "b.dll"],
        other: { [inGame("b.dll")]: "someone else's" },
      });
      const before = await snapshot(fs);

      const result = await runApply(fs, [link("a.dll"), link("b.dll")]);

      expectStatus(result, ApplyStatus.RolledBack);
      expect(result.failedAt).toMatchObject({ index: 1, operation: link("b.dll") });
      expect(await snapshot(fs)).toEqual(before);
    });
  });

  describe("a file and a folder swapping places", () => {
    const FAILS = link("not-in-staging.dll");

    test("links a file over a folder the run emptied", async () => {
      const fs = await seed({ staged: ["over/sub"], deployed: ["sub/a.dll"] });

      const result = await runApply(fs, [unlink("sub/a.dll"), linkFrom("over/sub", "sub")]);

      expectStatus(result, ApplyStatus.Applied);
      const after = await snapshot(fs);
      expect(after[inGame("sub")]).toBe(after[inStaging("over/sub")]);
    });

    test("puts the emptied folder and its file back when rolling back", async () => {
      const fs = await seed({ staged: ["over/sub"], deployed: ["sub/a.dll"] });
      const before = await snapshot(fs);

      const result = await runApply(fs, [unlink("sub/a.dll"), linkFrom("over/sub", "sub"), FAILS]);

      expectStatus(result, ApplyStatus.RolledBack);
      expect(await snapshot(fs)).toEqual(before);
    });

    test("rolls back rather than link over a folder with something in it", async () => {
      const fs = await seed({ staged: ["over/sub"], other: { [inGame("sub/mine.txt")]: "mine" } });
      const before = await snapshot(fs);

      expectStatus(await runApply(fs, [linkFrom("over/sub", "sub")]), ApplyStatus.RolledBack);

      expect(await snapshot(fs)).toEqual(before);
    });

    test.each<[string, Setup, Operation]>([
      ["deleted", { staged: ["in.dll"], deployed: ["sub"] }, unlink("sub")],
      ["kept", { staged: ["in.dll", "sub"], other: { [inGame("sub")]: "my edit" } }, unlink("sub")],
      ["backed up", { staged: ["in.dll"], other: { [inGame("sub")]: "game file" } }, backup("sub")],
    ])("puts a %s file back over the folder that replaced it", async (_name, setup, clearing) => {
      const fs = await seed(setup);
      const before = await snapshot(fs);

      const result = await runApply(fs, [clearing, linkFrom("in.dll", "sub/in.dll"), FAILS]);

      expectStatus(result, ApplyStatus.RolledBack);
      expect(await snapshot(fs)).toEqual(before);
    });

    test("leaves a backup when a LINK needs its destination as a folder", async () => {
      const fs = await seed({
        staged: ["in.dll"],
        deployed: ["sub"],
        other: { [backupOf("sub")]: "original" },
      });
      const before = await snapshot(fs);

      const result = await runApply(fs, [unlink("sub"), linkFrom("in.dll", "sub/in.dll")]);

      expectStatus(result, ApplyStatus.Applied);
      const after = await snapshot(fs);
      expect(after[inGame("sub/in.dll")]).toBe(after[inStaging("in.dll")]);
      expect(after[backupOf("sub")]).toBe(before[backupOf("sub")]);
    });
  });

  test("leaves no journal after a finished run", async () => {
    const fs = await seed({ staged: ["a.dll"] });
    const journal = await newJournal();

    expectStatus(await runApply(fs, [link("a.dll")], journal), ApplyStatus.Applied);

    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  test("keeps a finished run when its journal can't be removed, for a resume to end", async () => {
    const fs = await seed({ staged: ["a.dll"] });
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
    test.each<[string, RefusalReason, Operation]>([
      [
        "a generated file to link",
        RefusalReason.GeneratedFile,
        makeLinkOperation({ file: makeGeneratedFileSource() }),
      ],
      ["a LINK with no staged file", RefusalReason.NoStagedFile, link(UNSTAGED)],
      ["a backup name already taken", RefusalReason.BackupNameTaken, backup("taken.dll")],
    ])("%s", async (_name, reason, operation) => {
      const fs = await seed({
        staged: ["a.dll"],
        other: { [inGame("taken.dll")]: "game file", [backupOf("taken.dll")]: "earlier backup" },
      });
      const before = await snapshot(fs);
      const journal = await newJournal();

      const result = await runApply(fs, [link("a.dll"), operation], journal);

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(reason);
      expect(await snapshot(fs)).toEqual(before);
      expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
    });

    test("a staged path its journal couldn't read back", async () => {
      const fs = await seed({ staged: ["a.dll"] });
      const before = await snapshot(fs);
      const journal = await newJournal();

      const result = await apply([link("a.dll")], {
        ...optionsOn(fs, journal),
        backupPathOf,
        unlinkKeptPathOf,
        stagedFiles: { pathOf: () => "C:\\staging\\a.dll" },
      });

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.InvalidPath);
      expect(await snapshot(fs)).toEqual(before);
      expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
    });

    test("a journal in progress", async () => {
      const fs = await seed({ staged: ["a.dll"] });
      const before = await snapshot(fs);
      const journal = await newJournal();
      await (await createJournal(journal, [], RUN_ID)).close();

      const result = await runApply(fs, [link("a.dll")], journal);

      expectStatus(result, ApplyStatus.Refused);
      expect(result.reason).toBe(RefusalReason.JournalExists);
      expect(await snapshot(fs)).toEqual(before);
    });

    test("a journal that can't be read, keeping it", async () => {
      const fs = await seed({ staged: ["a.dll"] });
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
    const result = await settle(optionsOn(await seed({}), await newJournal()));

    expectStatus(result, ApplyStatus.NothingToDo);
  });

  test("refuses a journal that can't be read, keeping it", async () => {
    const journal = await unreadableJournal();

    const result = await settle(optionsOn(await seed({}), journal));

    expectStatus(result, ApplyStatus.Refused);
    expect(result.reason).toBe(RefusalReason.JournalUnavailable);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Invalid);
  });
});

describe("resumeApply", () => {
  test("rolls back when a RESTORE finds its destination occupied", async () => {
    const fs = await seed({
      other: { [inGame("a.dll")]: "someone else's", [backupOf("a.dll")]: "original" },
    });
    const before = await snapshot(fs);
    const journal = await newJournal();
    const operation = { kind: OperationKind.Restore, destinationPath: inGame("a.dll") };
    const writer = await createJournal(
      journal,
      [{ operation, keptPath: backupOf("a.dll") }],
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
    const keptPath = unlinkKeptPathOf(inGame("a.dll"), RUN_ID, 0);
    const fs = await seed({ staged: ["a.dll"], other: { [keptPath]: "my edit" } });
    const journal = await newJournal();
    const writer = await createJournal(
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
    expect(result.kept).toEqual([{ destinationPath: inGame("a.dll"), keptPath }]);
  });

  test("finishes a rollback rather than run it forward", async () => {
    const fs = await seed({ staged: ["a.dll"] });
    const before = await snapshot(fs);
    const journal = await newJournal();
    const writer = await createJournal(
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
  test("removes only the folders the run created", async () => {
    const fs = await seed({
      staged: ["kept/a.dll", "new/deep/b.dll"],
      other: { [inGame("kept/existing.dll")]: "game file" },
    });
    const before = await snapshot(fs);

    const result = await runApply(fs, [
      link("kept/a.dll"),
      link("new/deep/b.dll"),
      link("not-in-staging.dll"),
    ]);

    expectStatus(result, ApplyStatus.RolledBack);
    expect(await snapshot(fs)).toEqual(before);
  });

  test("leaves a folder the run created when something else is in it", async () => {
    const fs = await seed({ other: { [inGame("new/mine.txt")]: "mine" } });
    const journal = await newJournal();
    const writer = await createJournal(
      journal,
      [{ operation: link("new/a.dll"), stagedPath: inStaging("new/a.dll") }],
      RUN_ID,
    );
    await writer.recordFolder(0, inGame("new"));
    await writer.close();

    expectStatus(await rollback(optionsOn(fs, journal)), ApplyStatus.RolledBack);

    expect(await snapshot(fs)).toHaveProperty([inGame("new/mine.txt")]);
  });

  test("fails and keeps the journal when a LINK's destination is no longer ours", async () => {
    const fs = await seed({ staged: ["a.dll"], other: { [inGame("a.dll")]: "someone else's" } });
    const journal = await newJournal();
    const writer = await createJournal(
      journal,
      [{ operation: link("a.dll"), stagedPath: inStaging("a.dll") }],
      RUN_ID,
    );
    await writer.markDone(0);
    await writer.close();

    const result = await rollback(optionsOn(fs, journal));

    expectStatus(result, ApplyStatus.RollbackFailed);
    expect(result.rollbackFailedAt).toMatchObject({ index: 0 });
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Found);
  });
});

const WHOLE_RUN = [
  backup("replaced.dll"),
  unlink("removed.dll"),
  unlink("edited.dll"),
  unlink("restored.dll"),
  unlink("becomes-folder.dll"),
  unlink("becomes-file/a.dll"),
  link("replaced.dll"),
  link("sub/folder/new.dll"),
  linkFrom("inside.dll", "becomes-folder.dll/inside.dll"),
  linkFrom("over/becomes-file", "becomes-file"),
];
// staging has no such file, so its LINK fails once everything before it ran
const FAILING_RUN = [...WHOLE_RUN, link("not-in-staging.dll")];

const seedWholeRun = () =>
  seed({
    staged: ["replaced.dll", "edited.dll", "sub/folder/new.dll", "inside.dll", "over/becomes-file"],
    deployed: ["removed.dll", "restored.dll", "becomes-folder.dll", "becomes-file/a.dll"],
    other: {
      [inGame("replaced.dll")]: "game file",
      [inGame("edited.dll")]: "my edit",
      [backupOf("restored.dll")]: "original",
    },
  });

/** Every file and journal call after the first `calls` fails, as in a killed process. */
function killAfter(calls: number) {
  let used = 0;
  const isDead = () => used++ >= calls;
  const guarded = async <T>(call: () => Promise<T>) => {
    if (isDead()) {
      throw new Error("killed");
    }
    return call();
  };
  return {
    fs: (fs: FileSystem) =>
      new ChaosFS(fs, [
        { fault: { kind: "os:generic", originalCode: "EIO" }, times: Infinity, path: isDead },
      ]),
    journal: (journal: JournalStorage): JournalStorage => ({
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

async function runKilledAfter(
  operations: readonly Operation[],
  calls: number,
  journal: JournalStorage,
) {
  const fs = await seedWholeRun();
  const kill = killAfter(calls);
  await apply(operations, {
    files: applyFilesOn(kill.fs(fs)),
    journal: kill.journal(journal),
    backupPathOf,
    unlinkKeptPathOf,
    stagedFiles,
  });
  // a dead process holds no handle
  await journal.close();
  return { fs, callsUsed: kill.callsUsed() };
}

async function killedRun(operations: readonly Operation[], calls: number) {
  const journal = await newJournal();
  const { fs } = await runKilledAfter(operations, calls, journal);
  return { fs, journal };
}

// test.each needs these while collecting, where makeTempDir can't clean up
const killPoints = async (operations: readonly Operation[]) => {
  const folder = await mkdtemp(path.join(tmpdir(), "apply-kill-points-"));
  const journal = journalStorageAt(path.join(folder, "journal.ndjson"));
  const { callsUsed } = await runKilledAfter(operations, Number.POSITIVE_INFINITY, journal);
  await rm(folder, { recursive: true, force: true });
  return Array.from({ length: callsUsed }, (_, index) => index);
};

const startState = async () => snapshot(await seedWholeRun());
const finishedState = async () => {
  const fs = await seedWholeRun();
  await runApply(fs, WHOLE_RUN);
  return snapshot(fs);
};

describe("after a kill", async () => {
  const WHOLE_RUN_KILLS = await killPoints(WHOLE_RUN);
  const FAILING_RUN_KILLS = await killPoints(FAILING_RUN);

  test("the runs under test do real work", async () => {
    const start = await startState();
    const finished = await finishedState();

    expect(finished).toMatchObject({
      [backupOf("replaced.dll")]: start[inGame("replaced.dll")],
      [inGame("restored.dll")]: start[backupOf("restored.dll")],
      [`${KEPT}/run/2`]: start[inGame("edited.dll")],
    });
    expect(finished).not.toHaveProperty([inGame("removed.dll")]);
    expect(WHOLE_RUN_KILLS.length).toBeGreaterThan(WHOLE_RUN.length * 2);
  });

  test.each(WHOLE_RUN_KILLS)("resuming finishes a run killed at call %i", async (calls) => {
    const { fs, journal } = await killedRun(WHOLE_RUN, calls);
    const started = (await journalStatusOf(journal)) === JournalReadStatus.Found;

    const result = await resumeApply(optionsOn(fs, journal));

    expect(result.status).toBe(started ? ApplyStatus.Applied : ApplyStatus.NothingToDo);
    const finished = await finishedState();
    if (started) {
      expect(await snapshot(fs)).toEqual(finished);
    } else {
      expect([await startState(), finished]).toContainEqual(await snapshot(fs));
    }
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  test.each(WHOLE_RUN_KILLS)("rolling back undoes a run killed at call %i", async (calls) => {
    const { fs, journal } = await killedRun(WHOLE_RUN, calls);
    const started = (await journalStatusOf(journal)) === JournalReadStatus.Found;

    const result = await rollback(optionsOn(fs, journal));

    expect(result.status).toBe(started ? ApplyStatus.RolledBack : ApplyStatus.NothingToDo);
    const start = await startState();
    if (started) {
      expect(await snapshot(fs)).toEqual(start);
    } else {
      expect([start, await finishedState()]).toContainEqual(await snapshot(fs));
    }
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  describe.each([
    ["rollback", rollback],
    ["resumeApply", resumeApply],
  ])("%s", (_name, settle) => {
    test.each(FAILING_RUN_KILLS)("settles a failed run killed at call %i", async (calls) => {
      const { fs, journal } = await killedRun(FAILING_RUN, calls);

      await settle(optionsOn(fs, journal));

      expect(await snapshot(fs)).toEqual(await startState());
      expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
    });
  });
});
