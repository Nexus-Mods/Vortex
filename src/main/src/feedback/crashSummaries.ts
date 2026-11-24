import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";

import type { IFeedbackCrashDump } from "@vortex/shared/ipc";

import { summarizeMinidumpFile, type MinidumpResult } from "../minidump";

/** As many as a support bundle carries: the newest dumps are the crash being written in about. */
export const MAX_FEEDBACK_DUMPS = 3;

const WALK_DEPTH = 3;

interface IDumpFile {
  path: string;
  mtimeMs: number;
}

/**
 * Crashpad nests dumps in `reports/` and `pending/`, so walk shallowly. A `.dmp.claimed` file is
 * one the startup sweep is reporting right now, so only plain `.dmp` files are taken.
 */
async function collectDumps(dir: string, depth: number = 0): Promise<IDumpFile[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: IDumpFile[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < WALK_DEPTH) {
        found.push(...(await collectDumps(fullPath, depth + 1)));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".dmp")) {
      try {
        found.push({ path: fullPath, mtimeMs: (await stat(fullPath)).mtimeMs });
      } catch {
        // the startup sweep may be renaming or deleting it under us
      }
    }
  }
  return found;
}

/**
 * Summaries of the newest crash dumps under `dumpsDir`, newest first. The dumps are only read:
 * reporting and deleting them stays with the startup sweep.
 */
export async function summarizeLatestDumps(
  dumpsDir: string,
  summarize: (filePath: string) => Promise<MinidumpResult> = summarizeMinidumpFile,
): Promise<IFeedbackCrashDump[]> {
  const latest = (await collectDumps(dumpsDir))
    .toSorted((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs)
    .slice(0, MAX_FEEDBACK_DUMPS);

  const dumps: IFeedbackCrashDump[] = [];
  for (const dump of latest) {
    const { summary, unreadableReason } = await summarize(dump.path);
    dumps.push({
      file: path.basename(dump.path),
      modifiedAt: dump.mtimeMs,
      summary: summary === undefined ? undefined : { ...summary },
      unreadableReason,
    });
  }
  return dumps;
}
