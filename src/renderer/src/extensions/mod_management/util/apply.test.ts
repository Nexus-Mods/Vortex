import { KeptReason, type Operation } from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault } from "@vortex/shared";
import {
  InMemoryFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type FileSystem,
  type InMemoryStore,
  type StatResult,
} from "@vortex/shared/filesystem";
import { describe, expect, test, vi } from "vitest";

import { newJournal, startJournal, unreadableJournal } from "@/test-utils/journal";
import { makeNexusFileSource } from "@/test-utils/lockfileBuilders";
import {
  makeLinkOperation,
  makeRestoreOperation,
  makeUnlinkOperation,
} from "@/test-utils/operationBuilders";

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
import { FIXTURE_FOLDER_TAG } from "./apply/fixtureDisk";
import { JournalPhase, JournalReadStatus, readJournal, type JournalStorage } from "./apply/journal";

const ROOT = "/fixture-root";
const GAME = `${ROOT}/game`;
const STAGING = `${ROOT}/staging`;
const WORK = `${ROOT}/work`;
const KEPT = `${WORK}/kept`;
const OTHER_DRIVE = `${ROOT}/other-drive`;
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

interface Setup {
  /** files only in staging */
  staged?: string[];
  /** other files, by path, with their contents */
  other?: Record<string, string>;
}

function seeded({ staged = [], other = {} }: Setup): InMemoryFSBuilder {
  const builder = new InMemoryFSBuilder().dir(qualified(GAME)).dir(qualified(WORK));
  for (const name of staged) {
    builder.file(qualified(inStaging(name)), { type: "text", data: `staged ${name}` });
  }
  for (const [filePath, data] of Object.entries(other)) {
    builder.file(qualified(filePath), { type: "text", data });
  }
  return builder;
}

const seed = (setup: Setup): FileSystem => seeded(setup).build();

/** `OTHER_DRIVE` is on a second drive. */
class TwoDrivesFS extends InMemoryFS {
  override async stat(
    filePath: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    const status = await super.stat(filePath, options);
    return status.exists && filePath.path.startsWith(OTHER_DRIVE)
      ? { ...status, deviceId: status.deviceId + 1n }
      : status;
  }
}

const busy = () => Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });

/**
 * Removing `heldFolder` takes its tag and then fails, as when another program has the folder open;
 * while `tagWritesFail`, so does writing a tag.
 */
class HeldFolderFS extends InMemoryFS {
  isHeld = true;
  tagWritesFail = false;

  constructor(
    store: InMemoryStore,
    readonly heldFolder: string,
  ) {
    super(store);
  }

  override async deleteRecursive(folder: QualifiedPath): Promise<void> {
    if (this.isHeld && folder.path === this.heldFolder) {
      await super.delete(folder.join(FIXTURE_FOLDER_TAG.name));
      throw busy();
    }
    return super.deleteRecursive(folder);
  }

  override writeFile(filePath: QualifiedPath, contents: Uint8Array): Promise<void> {
    return this.tagWritesFail && filePath.basename === FIXTURE_FOLDER_TAG.name
      ? Promise.reject(busy())
      : super.writeFile(filePath, contents);
  }
}

/** A folder holding a deployed file and its tag, whose removal a held folder disk fails. */
function heldTaggedFolder() {
  const tagPath = inGame(`SkyUI/${FIXTURE_FOLDER_TAG.name}`);
  const builder = seeded({
    staged: ["SkyUI/a.dll"],
    other: { [tagPath]: FIXTURE_FOLDER_TAG.contents },
  });
  const fs = new HeldFolderFS(builder.store, inGame("SkyUI"));
  const withDeployedFile = async () => {
    await fs.createLink(
      qualified(inStaging("SkyUI/a.dll")),
      qualified(inGame("SkyUI/a.dll")),
      "hardlink",
    );
    return fs;
  };
  return { tagPath, withDeployedFile };
}

const unlinkInHeldFolder = (
  fs: FileSystem,
  journal: JournalStorage,
  recordDeployment?: () => Promise<void>,
) =>
  apply([unlink("SkyUI/a.dll")], {
    ...optionsOn(fs, journal),
    backupPathOf,
    keptPathOf,
    stagedFiles,
    folderTag: FIXTURE_FOLDER_TAG,
    recordDeployment,
  });

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

const optionsOn = (fs: FileSystem, journal: JournalStorage): RunOptions => ({ fs, journal });

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

  test("reports each step it completes, rising to the total", async () => {
    const fs = seed({ staged: ["a.dll", "b.dll", "c.dll"] });
    const onProgress = vi.fn<NonNullable<RunOptions["onProgress"]>>();

    await apply([link("a.dll"), link("b.dll"), link("c.dll")], {
      ...optionsOn(fs, await newJournal()),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [1, 3, JournalPhase.Applying],
      [2, 3, JournalPhase.Applying],
      [3, 3, JournalPhase.Applying],
    ]);
  });

  test("reports its rollback's steps after a step fails, rising to the steps that changed the disk", async () => {
    const fs = seed({ staged: ["a.dll", "b.dll"] });
    const onProgress = vi.fn<NonNullable<RunOptions["onProgress"]>>();

    const result = await apply([link("a.dll"), link("missing.dll"), link("b.dll")], {
      ...optionsOn(fs, await newJournal()),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      onProgress,
    });

    expectStatus(result, ApplyStatus.RolledBack);
    expect(
      onProgress.mock.calls.filter(([, , phase]) => phase === JournalPhase.RollingBack),
    ).toEqual([
      [1, 2, JournalPhase.RollingBack],
      [2, 2, JournalPhase.RollingBack],
    ]);
  });

  test("a progress callback that fails leaves the step it reported in place", async () => {
    const fs = seed({ staged: ["a.dll"] });

    const running = apply([link("a.dll")], {
      ...optionsOn(fs, await newJournal()),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      onProgress: () => {
        throw new Error("the progress bar is gone");
      },
    });

    await expect(running).rejects.toThrow("the progress bar is gone");
    const after = await snapshot(fs);
    expect(after[inGame("a.dll")]).toBe(after[inStaging("a.dll")]);
  });

  test("records its deployment from its operations once they ran, before its journal ends", async () => {
    const fs = seed({ staged: ["a.dll"] });
    const journal = await newJournal();
    const recorded: unknown[] = [];

    const result = await apply([link("a.dll")], {
      ...optionsOn(fs, journal),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      recordDeployment: async (entries) => {
        recorded.push({
          entries,
          linked: (await snapshot(fs))[inGame("a.dll")] !== undefined,
          journal: await journalStatusOf(journal),
        });
      },
    });

    expectStatus(result, ApplyStatus.Applied);
    expect(recorded).toEqual([
      {
        entries: [{ operation: link("a.dll"), stagedPath: inStaging("a.dll") }],
        linked: true,
        journal: JournalReadStatus.Found,
      },
    ]);
  });

  test("keeps a run whose deployment can't be recorded, for a resume to record", async () => {
    const fs = seed({ staged: ["a.dll"] });
    const journal = await newJournal();
    const recorded: unknown[] = [];

    const result = await apply([link("a.dll")], {
      ...optionsOn(fs, journal),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      recordDeployment: () => Promise.reject(new Error("the manifest is held open")),
    });

    expectStatus(result, ApplyStatus.Unfinished);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.Found);
    const resumed = await resumeApply({
      ...optionsOn(fs, journal),
      recordDeployment: (entries) => Promise.resolve(void recorded.push(entries)),
    });
    expectStatus(resumed, ApplyStatus.Applied);
    expect(recorded).toEqual([[{ operation: link("a.dll"), stagedPath: inStaging("a.dll") }]]);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  test("records no deployment for a run it rolls back", async () => {
    const fs = seed({ staged: ["a.dll"] });
    const recorded: unknown[] = [];

    const result = await apply([link("a.dll"), link("missing.dll")], {
      ...optionsOn(fs, await newJournal()),
      backupPathOf,
      keptPathOf,
      stagedFiles,
      recordDeployment: (entries) => Promise.resolve(void recorded.push(entries)),
    });

    expectStatus(result, ApplyStatus.RolledBack);
    expect(recorded).toEqual([]);
  });

  test("tags again an emptied folder whose removal took only its tag, and ends applied", async () => {
    const { tagPath, withDeployedFile } = heldTaggedFolder();
    const fs = await withDeployedFile();

    const result = await unlinkInHeldFolder(fs, await newJournal());

    expectStatus(result, ApplyStatus.Applied);
    const after = await snapshot(fs);
    expect(after[inGame("SkyUI/a.dll")]).toBeUndefined();
    expect(after[tagPath]).toMatch(/^a folder Vortex made#/);
  });

  test("records its deployment and ends applied when an emptied folder can neither be removed nor tagged again", async () => {
    const { withDeployedFile } = heldTaggedFolder();
    const fs = await withDeployedFile();
    fs.tagWritesFail = true;
    const recordDeployment = vi.fn(() => Promise.resolve());

    const result = await unlinkInHeldFolder(fs, await newJournal(), recordDeployment);

    expectStatus(result, ApplyStatus.Applied);
    expect(recordDeployment).toHaveBeenCalledOnce();
  });

  test("a resumed run removes a folder it recorded whose removal took only its tag", async () => {
    const { withDeployedFile } = heldTaggedFolder();
    const fs = await withDeployedFile();
    fs.tagWritesFail = true;
    const journal = await newJournal();
    const failing = { ...journal, remove: () => Promise.reject(new Error("held by a scanner")) };
    expectStatus(await unlinkInHeldFolder(fs, failing), ApplyStatus.Unfinished);
    fs.isHeld = false;
    fs.tagWritesFail = false;

    expectStatus(
      await resumeApply({ ...optionsOn(fs, journal), folderTag: FIXTURE_FOLDER_TAG }),
      ApplyStatus.Applied,
    );

    expect((await snapshot(fs))[inGame("SkyUI")]).toBeUndefined();
  });

  test("rolling back puts the tag back in a folder whose removal took only its tag", async () => {
    const { tagPath, withDeployedFile } = heldTaggedFolder();
    const fs = await withDeployedFile();
    fs.tagWritesFail = true;
    const journal = await newJournal();
    const failing = { ...journal, remove: () => Promise.reject(new Error("held by a scanner")) };
    expectStatus(await unlinkInHeldFolder(fs, failing), ApplyStatus.Unfinished);
    fs.isHeld = false;
    fs.tagWritesFail = false;

    expectStatus(
      await rollback({ ...optionsOn(fs, journal), folderTag: FIXTURE_FOLDER_TAG }),
      ApplyStatus.RolledBack,
    );

    const after = await snapshot(fs);
    expect(after[inGame("SkyUI/a.dll")]).toBe(after[inStaging("SkyUI/a.dll")]);
    expect(after[tagPath]).toMatch(/^a folder Vortex made#/);
  });

  test.each([
    ["a folder there", `${OTHER_DRIVE}/a.dll`],
    ["a folder not made yet", `${OTHER_DRIVE}/new/a.dll`],
  ])("rolls back a move into %s on another drive", async (_, keptPath) => {
    const builder = seeded({ staged: ["a.dll"], other: { [inGame("a.dll")]: "my edit" } });
    const fs = new TwoDrivesFS(builder.dir(qualified(OTHER_DRIVE)).store);
    const before = await snapshot(fs);

    const result = await apply([unlink("a.dll")], {
      ...optionsOn(fs, await newJournal()),
      backupPathOf,
      keptPathOf: () => keptPath,
      stagedFiles,
    });

    expectStatus(result, ApplyStatus.RolledBack);
    expect(getErrorMessageOrDefault(result.failedAt?.cause)).toContain("another drive");
    expect(await snapshot(fs)).toEqual(before);
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
  test("a resumed rollback reports its progress from the steps already undone", async () => {
    const fs = seed({ staged: ["a.dll", "b.dll"] });
    const journal = await newJournal();
    const writer = await startJournal(
      journal,
      [
        { operation: link("a.dll"), stagedPath: inStaging("a.dll") },
        { operation: link("b.dll"), stagedPath: inStaging("b.dll") },
      ],
      RUN_ID,
    );
    await writer.markChanging(0);
    await writer.markChanging(1);
    await writer.startRollback();
    await writer.markUndone(1);
    await writer.close();
    const onProgress = vi.fn<NonNullable<RunOptions["onProgress"]>>();

    expectStatus(
      await resumeApply({ ...optionsOn(fs, journal), onProgress }),
      ApplyStatus.RolledBack,
    );

    expect(onProgress.mock.calls).toEqual([[2, 2, JournalPhase.RollingBack]]);
  });

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
