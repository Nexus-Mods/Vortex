import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

import { apply, ApplyStatus, resumeApply, rollback, type ApplyOptions } from "./apply";
import type { ApplyFixture } from "./applyFixture";
import { ApplyFixtureSchema } from "./applyFixture";
import { JournalReadStatus, readJournal, type JournalStorage } from "./journal";
import { killAfter, MemoryDisk } from "./testApplyFiles";
import { memoryJournalStorage } from "./testJournalStorage";

const fixtureDir = path.join(__dirname, "fixtures");
const fixtures = readdirSync(fixtureDir)
  .filter((fileName) => fileName.endsWith(".json"))
  .toSorted()
  .map((fileName) => {
    const parsed = ApplyFixtureSchema.safeParse(
      JSON.parse(readFileSync(path.join(fixtureDir, fileName), "utf8")),
    );
    if (!parsed.success) {
      throw new Error(`${fileName} is not an apply fixture: ${parsed.error.message}`);
    }
    return parsed.data;
  });

/** Fixtures name a destination's backup by this suffix, and keep a set-aside file by its entry. */
const optionsFor = (fixture: ApplyFixture): Omit<ApplyOptions, "files" | "journal"> => ({
  stagedFiles: { pathOf: (file) => fixture.staged[file.fileHash] },
  backupPathOf: (destinationPath) => `${destinationPath}.backup`,
  keptPathOf: (_destinationPath, _runId, entryIndex) => `/fixture-root/kept/${entryIndex}`,
});

const journalStatusOf = async (journal: JournalStorage) => (await readJournal(journal)).status;

/** What the fixture's result must hold. */
function resultOf({ expected }: ApplyFixture) {
  switch (expected.status) {
    case ApplyStatus.Applied:
      return { status: expected.status, kept: expected.kept };
    case ApplyStatus.RolledBack:
      return { status: expected.status, failedAt: { index: expected.failedAt } };
    case ApplyStatus.Refused:
      return { status: expected.status, reason: expected.reason };
    default: {
      const exhausted: never = expected;
      throw new Error(`unknown outcome ${JSON.stringify(exhausted)}`);
    }
  }
}

async function killedRun(fixture: ApplyFixture, calls: number) {
  const disk = new MemoryDisk(fixture.disk);
  const journal = memoryJournalStorage();
  const kill = killAfter(calls);
  await apply(fixture.operations, {
    ...optionsFor(fixture),
    files: kill.files(disk.files()),
    journal: kill.journal(journal),
  });
  return { disk, journal, callsUsed: kill.callsUsed() };
}

const killPoints = async (fixture: ApplyFixture) => {
  const { callsUsed } = await killedRun(fixture, Number.POSITIVE_INFINITY);
  return Array.from({ length: callsUsed }, (_, index) => index);
};

test("the apply fixtures are present", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

describe.each(fixtures)("$name", async (fixture) => {
  const before = new MemoryDisk(fixture.disk).snapshot();
  /** a run that doesn't apply leaves the disk as it found it */
  const after = fixture.expected.status === ApplyStatus.Applied ? fixture.expected.disk : before;

  test("the run ends as expected", async () => {
    const disk = new MemoryDisk(fixture.disk);
    const journal = memoryJournalStorage();

    const result = await apply(fixture.operations, {
      ...optionsFor(fixture),
      files: disk.files(),
      journal,
    });

    expect(result).toMatchObject(resultOf(fixture));
    expect(disk.snapshot()).toEqual(after);
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  if (fixture.expected.status === ApplyStatus.Refused) {
    return;
  }
  const kills = await killPoints(fixture);

  test.each(kills)("resuming settles a run killed at call %i", async (calls) => {
    const { disk, journal } = await killedRun(fixture, calls);
    const started = (await journalStatusOf(journal)) === JournalReadStatus.Found;

    const result = await resumeApply({ files: disk.files(), journal });

    expect(result.status).toBe(started ? fixture.expected.status : ApplyStatus.NothingToDo);
    // a run killed before its journal holds nothing, and one killed after it ends is done
    const settled = started ? [after] : [before, after];
    expect(settled).toContainEqual(disk.snapshot());
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });

  test.each(kills)("rolling back undoes a run killed at call %i", async (calls) => {
    const { disk, journal } = await killedRun(fixture, calls);
    const started = (await journalStatusOf(journal)) === JournalReadStatus.Found;

    const result = await rollback({ files: disk.files(), journal });

    expect(result.status).toBe(started ? ApplyStatus.RolledBack : ApplyStatus.NothingToDo);
    const settled = started ? [before] : [before, after];
    expect(settled).toContainEqual(disk.snapshot());
    expect(await journalStatusOf(journal)).toBe(JournalReadStatus.None);
  });
});
