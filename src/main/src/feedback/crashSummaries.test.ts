import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MinidumpResult } from "../minidump";
import { summarizeLatestDumps } from "./crashSummaries";

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);

let root: string;

const writeDump = async (relative: string, ageSeconds: number): Promise<void> => {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "dump");
  const when = new Date(NOW - ageSeconds * 1000);
  await utimes(file, when, when);
};

const summarize = vi.fn<(filePath: string) => Promise<MinidumpResult>>();

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "vortex-feedback-dumps-"));
  summarize.mockReset().mockResolvedValue({
    summary: { exceptionCode: "0xc0000005", exceptionAddress: "0x1", module: "a.dll" },
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("summarizeLatestDumps", () => {
  it("summarises the three newest dumps, newest first, from nested folders", async () => {
    await writeDump("reports/oldest.dmp", 400);
    await writeDump("reports/third.dmp", 300);
    await writeDump("pending/second.dmp", 200);
    await writeDump("newest.dmp", 100);

    const dumps = await summarizeLatestDumps(root, summarize);

    expect(dumps.map((dump) => dump.file)).toEqual(["newest.dmp", "second.dmp", "third.dmp"]);
    expect(dumps[0]).toEqual({
      file: "newest.dmp",
      modifiedAt: NOW - 100_000,
      summary: { exceptionCode: "0xc0000005", exceptionAddress: "0x1", module: "a.dll" },
      unreadableReason: undefined,
    });
  });

  it("leaves alone a dump the startup sweep has claimed, and files that are not dumps", async () => {
    await writeDump("reports/claimed.dmp.claimed", 10);
    await writeDump("reports/notes.txt", 10);
    await writeDump("reports/real.dmp", 20);

    const dumps = await summarizeLatestDumps(root, summarize);

    expect(dumps.map((dump) => dump.file)).toEqual(["real.dmp"]);
  });

  it("says why a dump could not be read", async () => {
    await writeDump("broken.dmp", 10);
    summarize.mockResolvedValueOnce({ unreadableReason: "invalid-signature" });

    const dumps = await summarizeLatestDumps(root, summarize);

    expect(dumps[0]).toMatchObject({ summary: undefined, unreadableReason: "invalid-signature" });
  });

  it("returns nothing when the folder is missing", async () => {
    expect(await summarizeLatestDumps(path.join(root, "absent"), summarize)).toEqual([]);
  });
});
