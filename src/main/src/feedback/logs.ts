import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import * as path from "node:path";
import { createInterface } from "node:readline";

import {
  getErrorMessageOrDefault,
  isBundledLogFile,
  redactSensitiveText,
  type FeedbackLogEntry,
} from "@vortex/shared";

import { log } from "../logging";
import type { IFeedbackLogFile } from "./records";

/** `<ISO time> [<LEVEL>] <rest>`, as the file formatter in `src/main/src/logging.ts` writes it. */
const ENTRY_START_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) \[([A-Za-z]+)\] ?(.*)$/;

/**
 * `<success|failed> - (<Unix ms>) <rest>`, as the Nexus Mods request log (`network.log`) is written
 * by `requestLog` in the renderer's nexus_integration extension.
 */
const REQUEST_ENTRY_START_RE = /^(success|failed) - \((\d+)\) ?(.*)$/;

/**
 * The level of a vortex.log entry in the words network.log entries use, so one feedback's entries
 * filter by a single set of levels. The file formatter in `src/main/src/logging.ts` shortens some.
 */
function entryLevel(tag: string): string {
  switch (tag) {
    case "DEBG":
      return "debug";
    case "ERRO":
      return "error";
    default:
      return tag.toLowerCase();
  }
}

/** The entry a line starts, in either log format, or undefined for a line that continues one. */
function startEntry(line: string): FeedbackLogEntry | undefined {
  const match = ENTRY_START_RE.exec(line);
  if (match !== null) {
    return { ts: match[1]!, level: entryLevel(match[2]!), message: match[3]! };
  }
  const request = REQUEST_ENTRY_START_RE.exec(line);
  if (request !== null) {
    const time = new Date(Number(request[2]));
    if (!Number.isNaN(time.getTime())) {
      return {
        ts: time.toISOString(),
        level: request[1] === "failed" ? "error" : "info",
        message: request[3]!,
      };
    }
  }
  return undefined;
}

/**
 * Puts log lines together into entries, a line at a time. A line that does not start a new entry,
 * such as a line of a stack trace, belongs to the entry above it. Lines before the first entry are
 * dropped: they are the tail of an entry cut off by rotation.
 */
export class LogEntryReader {
  #current: FeedbackLogEntry | undefined;

  /** Takes the next line; returns the entry it completed, when it starts a new one. */
  public push(line: string): FeedbackLogEntry | undefined {
    const started = startEntry(line);
    if (started !== undefined) {
      const done = this.#current;
      this.#current = started;
      return done;
    }
    if (this.#current !== undefined && line !== "") {
      this.#current.message += `\n${line}`;
    }
    return undefined;
  }

  /** The entry still open at the end of the text. */
  public end(): FeedbackLogEntry | undefined {
    const done = this.#current;
    this.#current = undefined;
    return done;
  }
}

/** Splits log text into entries (see `LogEntryReader`). */
export function parseLogEntries(text: string): FeedbackLogEntry[] {
  const reader = new LogEntryReader();
  const entries: FeedbackLogEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const done = reader.push(line);
    if (done !== undefined) entries.push(done);
  }
  const last = reader.end();
  if (last !== undefined) entries.push(last);
  return entries;
}

/** How much of a log file is read at a time while looking back from its end for `since`. */
const SEEK_CHUNK_BYTES = 1024 * 1024;

/**
 * Where to start reading a log file so that no entry from `since` on is missed: the start of a line
 * that begins an entry written before `since`, found by reading back from the end a chunk at a
 * time, or 0 when there is none. network.log is never rotated, and the window is at its end, so
 * this keeps a feedback from parsing years of requests.
 */
export async function findLogStartOffset(
  filePath: string,
  since: number,
  chunkBytes: number = SEEK_CHUNK_BYTES,
): Promise<number> {
  const file = await open(filePath, "r");
  try {
    const { size } = await file.stat();
    const buffer = Buffer.alloc(chunkBytes);
    for (let end = size; end > 0; ) {
      const start = Math.max(0, end - chunkBytes);
      const { bytesRead } = await file.read(buffer, 0, end - start, start);
      const chunk = buffer.subarray(0, bytesRead);
      // A newline byte is never part of a longer character, so a line starts cleanly after one.
      // Unless the chunk starts the file, its first line may be cut and is left to the next chunk.
      const firstFull = start === 0 ? 0 : chunk.indexOf(0x0a) + 1;
      if (start === 0 || firstFull > 0) {
        for (let lineStart = firstFull; lineStart < chunk.length; ) {
          const newline = chunk.indexOf(0x0a, lineStart);
          const lineEnd = newline === -1 ? chunk.length : newline;
          const line = chunk.toString("utf8", lineStart, lineEnd).replace(/\r$/, "");
          const entry = startEntry(line);
          if (entry !== undefined) {
            // the first entry in the chunk decides: one written before `since` is safe to start at
            if (Date.parse(entry.ts) < since) return start + lineStart;
            break;
          }
          lineStart = lineEnd + 1;
        }
      }
      // the next chunk takes in this one's cut first line; a line longer than a chunk is skipped
      const next = start + firstFull;
      end = firstFull > 0 && next < end ? next : start;
    }
    return 0;
  } finally {
    await file.close();
  }
}

/**
 * The entries of one log file written from `since` up to and including `until`, both Unix times
 * in milliseconds, with their messages redacted. Reading starts near the first entry of the window
 * (`findLogStartOffset`) and goes a line at a time; only the entries kept are redacted, and reading
 * stops at the first entry past `until`, since a log is written in order. The end is fixed so that
 * reading the logs again later gives the same entries.
 */
export async function readLogFileWindow(
  filePath: string,
  since: number,
  until: number,
  redact: (text: string) => string = redactSensitiveText,
): Promise<FeedbackLogEntry[]> {
  const start = await findLogStartOffset(filePath, since);
  const stream = createReadStream(filePath, { encoding: "utf8", start });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const reader = new LogEntryReader();
  const kept: FeedbackLogEntry[] = [];

  /** Keeps the entry when it is in the window; true once the window is behind it. */
  const take = (entry: FeedbackLogEntry): boolean => {
    const time = Date.parse(entry.ts);
    if (time > until) return true;
    if (time >= since) kept.push({ ...entry, message: redact(entry.message) });
    return false;
  };

  try {
    let past = false;
    for await (const line of lines) {
      const done = reader.push(line);
      if (done !== undefined && take(done)) {
        past = true;
        break;
      }
    }
    const last = reader.end();
    if (!past && last !== undefined) take(last);
  } finally {
    lines.close();
    stream.destroy();
  }
  return kept;
}

/**
 * The log entries written from `since` to `until` in the log files under `dir`, redacted as a
 * support bundle's logs are. A file last written before `since` holds nothing in the window, so it
 * is not read.
 */
export async function readRecentLogs(
  dir: string,
  since: number,
  until: number,
): Promise<IFeedbackLogFile[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter(isBundledLogFile).toSorted();
  } catch (err) {
    log("warn", "failed to list log files for feedback", {
      error: getErrorMessageOrDefault(err),
    });
    return [];
  }

  const logs: IFeedbackLogFile[] = [];
  for (const name of names) {
    const filePath = path.join(dir, name);
    try {
      if ((await stat(filePath)).mtimeMs < since) continue;
      const entries = await readLogFileWindow(filePath, since, until);
      if (entries.length > 0) {
        logs.push({ file: name, entries });
      }
    } catch (err) {
      // rotated away or locked: the feedback goes without this one file
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log("warn", "failed to read log file for feedback", {
          name,
          error: getErrorMessageOrDefault(err),
        });
      }
    }
  }
  return logs;
}
