import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findLogStartOffset, parseLogEntries, readLogFileWindow, readRecentLogs } from "./logs";

vi.mock("../logging", () => ({ log: vi.fn<() => void>() }));

describe("parseLogEntries", () => {
  it("reads the time, level and message of each entry", () => {
    const text = [
      "2026-11-19T10:00:00.000Z [INFO] [main] starting",
      "2026-11-19T10:00:01.250Z [WARN] [renderer] slow frame {}",
    ].join("\n");

    expect(parseLogEntries(text)).toEqual([
      { ts: "2026-11-19T10:00:00.000Z", level: "info", message: "[main] starting" },
      { ts: "2026-11-19T10:00:01.250Z", level: "warn", message: "[renderer] slow frame {}" },
    ]);
  });

  it("keeps the lines of a stack trace with the entry above them", () => {
    const text = [
      "2026-11-19T10:00:00.000Z [ERRO] [main] failed Error: boom",
      "    at run (file.js:1:1)",
      "    at main (file.js:2:2)",
      "2026-11-19T10:00:01.000Z [INFO] [main] next",
    ].join("\r\n");

    const entries = parseLogEntries(text);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.message).toBe(
      "[main] failed Error: boom\n    at run (file.js:1:1)\n    at main (file.js:2:2)",
    );
  });

  it("drops lines before the first entry", () => {
    const text = "    at cutOff (file.js:1:1)\n2026-11-19T10:00:00.000Z [INFO] [main] first";

    expect(parseLogEntries(text)).toEqual([
      { ts: "2026-11-19T10:00:00.000Z", level: "info", message: "[main] first" },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(parseLogEntries("")).toEqual([]);
  });

  it("reads the Nexus Mods request log, whose time is in Unix milliseconds", () => {
    const text = [
      "success - (1795435200000) getModInfo (skyrimse, 3863) from refreshMod",
      "failed - (1795435201500) getFileInfo (skyrimse, 3863, 7) from refreshMod: Not found",
    ].join("\n");

    expect(parseLogEntries(text)).toEqual([
      {
        ts: "2026-11-23T12:00:00.000Z",
        level: "info",
        message: "getModInfo (skyrimse, 3863) from refreshMod",
      },
      {
        ts: "2026-11-23T12:00:01.500Z",
        level: "error",
        message: "getFileInfo (skyrimse, 3863, 7) from refreshMod: Not found",
      },
    ]);
  });
});

const at = (iso: string): number => Date.parse(iso);

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "vortex-feedback-logs-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const writeLog = async (name: string, lines: string[], modified: string): Promise<string> => {
  const file = path.join(root, name);
  await writeFile(file, lines.join("\n"));
  await utimes(file, new Date(modified), new Date(modified));
  return file;
};

describe("readLogFileWindow", () => {
  it("keeps the entries from the start to the end given, both included", async () => {
    const file = await writeLog(
      "vortex.log",
      [
        "2026-11-19T09:59:59.999Z [INFO] [main] before",
        "2026-11-19T10:00:00.000Z [INFO] [main] at the start",
        "2026-11-19T10:30:00.000Z [INFO] [main] at the end",
        "2026-11-19T10:30:00.001Z [INFO] [main] after",
      ],
      "2026-11-19T10:30:00.001Z",
    );

    const kept = await readLogFileWindow(
      file,
      at("2026-11-19T10:00:00.000Z"),
      at("2026-11-19T10:30:00.000Z"),
    );

    expect(kept.map((entry) => entry.message)).toEqual([
      "[main] at the start",
      "[main] at the end",
    ]);
  });

  it("redacts only the entries it keeps, stack trace and all", async () => {
    const redact = vi.fn((text: string) => text.replace("bob", "<USER>"));
    const file = await writeLog(
      "vortex.log",
      [
        "2026-11-19T09:00:00.000Z [INFO] [main] long before, for bob",
        "2026-11-19T10:00:00.000Z [ERRO] [main] failed",
        "    at /home/bob/x.js",
      ],
      "2026-11-19T10:00:00.000Z",
    );

    const kept = await readLogFileWindow(
      file,
      at("2026-11-19T10:00:00.000Z"),
      at("2026-11-19T11:00:00.000Z"),
      redact,
    );

    expect(kept).toEqual([
      {
        ts: "2026-11-19T10:00:00.000Z",
        level: "error",
        message: "[main] failed\n    at /home/<USER>/x.js",
      },
    ]);
    expect(redact).toHaveBeenCalledTimes(1);
  });
});

describe("findLogStartOffset", () => {
  /**
   * A request log with an entry a minute from 10:00: one entry longer than the smaller chunks,
   * some that run over two lines, and characters of more than one byte.
   */
  const requestLog = (): string[] =>
    Array.from({ length: 120 }, (_unused, index) => {
      const time = at("2026-11-19T10:00:00.000Z") + index * 60_000;
      const rest = index === 40 ? "x".repeat(300) : `GET /mods/${index} für Ünïcødé`;
      const more = index % 10 === 5 ? "\n    at the next line" : "";
      return `${index % 3 === 0 ? "failed" : "success"} - (${time}) ${rest}${more}`;
    });

  it("starts at an entry written before the window, reading back from the end", async () => {
    const lines = requestLog();
    const file = await writeLog("network.log", lines, "2026-11-19T12:00:00.000Z");
    const since = at("2026-11-19T11:30:00.000Z");

    const offset = await findLogStartOffset(file, since, 64);

    const rest = (await readFile(file)).subarray(offset).toString("utf8");
    const first = parseLogEntries(rest)[0]!;
    expect(offset).toBeGreaterThan(0);
    expect(at(first.ts)).toBeLessThan(since);
    // no more than a chunk or so before the window
    expect(at(first.ts)).toBeGreaterThanOrEqual(since - 2 * 60_000);
  });

  it("gives the same window as reading the whole file, whatever the chunk size", async () => {
    const lines = requestLog();
    const file = await writeLog("network.log", lines, "2026-11-19T12:00:00.000Z");
    const full = parseLogEntries(lines.join("\n"));

    for (const minute of [0, 30, 41, 90, 119]) {
      const since = at("2026-11-19T10:00:00.000Z") + minute * 60_000;
      for (const chunk of [16, 64, 1024, 1024 * 1024]) {
        const offset = await findLogStartOffset(file, since, chunk);
        const rest = parseLogEntries((await readFile(file)).subarray(offset).toString("utf8"));
        expect(rest.filter((entry) => at(entry.ts) >= since)).toEqual(
          full.filter((entry) => at(entry.ts) >= since),
        );
      }
    }
  });

  it("starts at the beginning of a file written entirely in the window", async () => {
    const file = await writeLog("network.log", requestLog(), "2026-11-19T12:00:00.000Z");

    expect(await findLogStartOffset(file, at("2026-11-19T09:00:00.000Z"), 64)).toBe(0);
  });
});

describe("readRecentLogs", () => {
  it("reads the log files with entries in the window, and skips one last written before it", async () => {
    await writeLog(
      "vortex1.log",
      ["2026-11-19T08:00:00.000Z [INFO] [main] yesterday's news"],
      "2026-11-19T08:00:00.000Z",
    );
    await writeLog(
      "vortex.log",
      ["2026-11-19T10:15:00.000Z [INFO] [main] recent"],
      "2026-11-19T10:15:00.000Z",
    );
    await writeLog(
      "startup.log",
      ["2026-11-19T10:15:00.000Z [INFO] [main] not a bundled log"],
      "2026-11-19T10:15:00.000Z",
    );

    const logs = await readRecentLogs(
      root,
      at("2026-11-19T10:00:00.000Z"),
      at("2026-11-19T11:00:00.000Z"),
    );

    expect(logs).toEqual([
      {
        file: "vortex.log",
        entries: [{ ts: "2026-11-19T10:15:00.000Z", level: "info", message: "[main] recent" }],
      },
    ]);
  });

  it("gives nothing for a folder that cannot be read", async () => {
    expect(await readRecentLogs(path.join(root, "missing"), 0, Date.now())).toEqual([]);
  });
});
