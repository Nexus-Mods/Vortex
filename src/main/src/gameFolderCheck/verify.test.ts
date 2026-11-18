import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { GameFolderCheckLimits } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { pathKey, type IBaseline } from "./baseline";
import { DEPOT_FLAG, type IDepotFile } from "./depotManifest";
import { chooseFilesToHash, sampledChunkIndices, verifySteamFiles } from "./verify";

const CHUNK = 4;
const LIMITS: GameFolderCheckLimits = {
  maxDurationMs: 60_000,
  maxBytes: 1024 * 1024 * 1024,
  hashConcurrency: 4,
  hashSampleExecutables: 1000,
  hashSampleFiles: 1000,
  maxUnknownPaths: 1000,
};

const sha1 = (data: string): string => createHash("sha1").update(data).digest("hex");

/** A depot entry for `content`, split into chunks of CHUNK bytes and listed out of order. */
function depotFile(name: string, content: string, flags = 0): IDepotFile {
  const chunks = [];
  for (let offset = 0; offset < content.length; offset += CHUNK) {
    const part = content.slice(offset, offset + CHUNK);
    chunks.push({ sha1: sha1(part), offset, size: part.length });
  }
  return { name, size: content.length, flags, sha1: sha1(content), linkTarget: "", chunks };
}

function setup(steamFiles: Record<string, string>, diskFiles: Record<string, string>) {
  const gamePath = mkdtempSync(path.join(tmpdir(), "gfc-verify-"));
  for (const [relPath, content] of Object.entries(diskFiles)) {
    const full = path.join(gamePath, ...relPath.split("\\"));
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const baseline: IBaseline = { files: new Map(), manifestCreatedAt: {} };
  for (const [name, content] of Object.entries(steamFiles)) {
    baseline.files.set(pathKey(name), depotFile(name, content));
  }
  return { gamePath, baseline };
}

const verify = (
  gamePath: string,
  baseline: IBaseline,
  overrides: Partial<{
    fullVerify: boolean;
    limits: GameFolderCheckLimits;
    signal: AbortSignal;
  }> = {},
) =>
  verifySteamFiles(gamePath, baseline, {
    fullVerify: false,
    limits: LIMITS,
    startedAt: Date.now(),
    signal: new AbortController().signal,
    ...overrides,
  });

// 40 bytes, ten chunks; the sample reads chunks 0, 3, 6 and 9
const ORIGINAL = "aaaabbbbccccddddeeeeffffgggghhhhiiiijjjj";
const replaceChunk = (content: string, index: number) =>
  content.slice(0, index * CHUNK) + "XXXX" + content.slice((index + 1) * CHUNK);

describe("sampledChunkIndices", () => {
  it("takes every chunk of a small file", () => {
    expect([...sampledChunkIndices(3)]).toEqual([0, 1, 2]);
  });

  it("takes first, last and two from the middle", () => {
    expect([...sampledChunkIndices(10)].toSorted((a, b) => a - b)).toEqual([0, 3, 6, 9]);
  });
});

const isExecutable = (name: string) => /\.(exe|dll)$/i.test(name);

/** A seeded sequence, so a sample can be reproduced. */
const sequence = () => {
  let state = 1;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
};

describe("chooseFilesToHash", () => {
  const files = ["a.exe", "b.DLL", "c.bsa", "d.bsa", "e.bsa", "f.bsa"].map((name) => ({ name }));

  it("caps executables separately and keeps them first", () => {
    const { chosen, capped } = chooseFilesToHash(files, 1, 10, () => 0);
    expect(chosen.filter((file) => isExecutable(file.name))).toHaveLength(1);
    expect(isExecutable(chosen[0]!.name)).toBe(true);
    expect(chosen).toHaveLength(5);
    expect(capped).toBe(true);
  });

  it("takes every executable under the cap and samples the rest", () => {
    const { chosen, capped } = chooseFilesToHash(files, 10, 2, () => 0);
    expect(chosen.slice(0, 2).map((file) => file.name)).toEqual(["a.exe", "b.DLL"]);
    expect(chosen).toHaveLength(4);
    expect(chosen.slice(2).every((file) => file.name.endsWith(".bsa"))).toBe(true);
    expect(capped).toBe(true);
  });

  it("picks the same files for the same random sequence", () => {
    const first = chooseFilesToHash(files, 1, 2, sequence()).chosen.map((file) => file.name);
    const second = chooseFilesToHash(files, 1, 2, sequence()).chosen.map((file) => file.name);
    expect(first).toEqual(second);
  });

  it("isn't capped when the sample covers every file", () => {
    expect(chooseFilesToHash(files, 10, 10, Math.random)).toMatchObject({ capped: false });
    expect(chooseFilesToHash(files, 10, 10, Math.random).chosen).toHaveLength(6);
  });
});

describe("verifySteamFiles", () => {
  it("verifies an untouched file", async () => {
    const { gamePath, baseline } = setup({ "Data\\a.bsa": ORIGINAL }, { "Data\\a.bsa": ORIGINAL });
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get(pathKey("Data\\a.bsa"))).toEqual({ kind: "verified" });
    expect(result.status).toEqual({ status: "checked", reason: null });
  });

  it("catches a size change without reading", async () => {
    const { gamePath, baseline } = setup({ "a.bsa": ORIGINAL }, { "a.bsa": ORIGINAL + "x" });
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("a.bsa")).toMatchObject({ kind: "modified", by: "size" });
    expect(result.bytesRead).toBe(0);
  });

  it("catches an edit in a sampled chunk", async () => {
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL },
      { "a.bsa": replaceChunk(ORIGINAL, 6) },
    );
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("a.bsa")).toMatchObject({ kind: "modified", by: "sampled_chunk" });
  });

  it("misses an edit outside the sample", async () => {
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL },
      { "a.bsa": replaceChunk(ORIGINAL, 5) },
    );
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("a.bsa")).toEqual({ kind: "verified" });
  });

  it("hashes an executable in full", async () => {
    const exe = "MZ" + ORIGINAL.slice(2);
    const { gamePath, baseline } = setup({ "game.bin": exe }, { "game.bin": replaceChunk(exe, 5) });
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("game.bin")).toMatchObject({ kind: "modified", by: "full_hash" });
  });

  it("records what the sample would have missed on a full verify", async () => {
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL },
      { "a.bsa": replaceChunk(ORIGINAL, 5) },
    );
    const result = await verify(gamePath, baseline, { fullVerify: true });
    expect(result.outcomes.get("a.bsa")).toMatchObject({
      kind: "modified",
      by: "full_hash",
      chunkSampleWouldMiss: true,
      fileSampleWouldMiss: false,
    });
  });

  it("checks the backup Vortex made instead of the deployed file", async () => {
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL },
      { "a.bsa": "a mod's file", "a.bsa.vortex_backup": ORIGINAL },
    );
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("a.bsa")).toEqual({ kind: "verified" });
  });

  it("reports a file that isn't there as absent", async () => {
    const { gamePath, baseline } = setup({ "a.bsa": ORIGINAL }, {});
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("a.bsa")).toEqual({ kind: "absent" });
  });

  it("doesn't compare user config", async () => {
    const { gamePath, baseline } = setup({}, { "game.ini": "changed" });
    baseline.files.set("game.ini", depotFile("game.ini", "original", DEPOT_FLAG.userConfig));
    const result = await verify(gamePath, baseline);
    expect(result.outcomes.get("game.ini")).toEqual({ kind: "not_compared" });
  });

  it("stops at the time limit and marks the rest unchecked", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [`f${index}.bsa`, ORIGINAL]),
    );
    const { gamePath, baseline } = setup(files, files);
    const result = await verify(gamePath, baseline, {
      limits: { ...LIMITS, maxDurationMs: 0 },
    });
    expect(result.status).toEqual({ status: "aborted", reason: "max_duration" });
    const kinds = new Set([...result.outcomes.values()].map((outcome) => outcome.kind));
    expect(kinds).toEqual(new Set(["unchecked"]));
  });

  it("stops at the byte limit and marks the rest unchecked", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [`f${index}.bsa`, ORIGINAL]),
    );
    const { gamePath, baseline } = setup(files, files);
    const result = await verify(gamePath, baseline, {
      limits: { ...LIMITS, maxBytes: CHUNK * 4, hashConcurrency: 1 },
    });
    expect(result.status).toEqual({ status: "aborted", reason: "max_bytes" });
    const kinds = [...result.outcomes.values()].map((outcome) => outcome.kind);
    expect(kinds).toContain("verified");
    expect(kinds).toContain("unchecked");
  });

  it("size-checks files it doesn't hash and still hashes executables", async () => {
    const exe = "MZ" + ORIGINAL.slice(2);
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL, "b.bsa": ORIGINAL, "c.bsa": ORIGINAL, "game.dll": exe },
      {
        "a.bsa": replaceChunk(ORIGINAL, 3),
        "b.bsa": ORIGINAL + "x",
        "game.dll": replaceChunk(exe, 5),
      },
    );
    const result = await verify(gamePath, baseline, { limits: { ...LIMITS, hashSampleFiles: 0 } });
    expect(result.outcomes.get("a.bsa")).toEqual({ kind: "size_matched" });
    expect(result.outcomes.get("b.bsa")).toMatchObject({ kind: "modified", by: "size" });
    expect(result.outcomes.get("c.bsa")).toEqual({ kind: "absent" });
    expect(result.outcomes.get("game.dll")).toMatchObject({ kind: "modified", by: "full_hash" });
    expect(result.hashSample).toEqual({ files: 1, capped: true });
  });

  it("hashes executables before the sample", async () => {
    const exe = "MZ" + ORIGINAL.slice(2);
    const files = { "a.bsa": ORIGINAL, "b.bsa": ORIGINAL, "game.dll": exe };
    const { gamePath, baseline } = setup(files, files);
    const result = await verify(gamePath, baseline, {
      limits: { ...LIMITS, maxBytes: exe.length, hashConcurrency: 1 },
    });
    expect(result.outcomes.get("game.dll")).toEqual({ kind: "verified" });
    expect(result.outcomes.get("a.bsa")).toEqual({ kind: "unchecked" });
    expect(result.outcomes.get("b.bsa")).toEqual({ kind: "unchecked" });
  });

  it("hashes everything on a full verify and records what the file sample would miss", async () => {
    const { gamePath, baseline } = setup(
      { "a.bsa": ORIGINAL },
      { "a.bsa": replaceChunk(ORIGINAL, 3) },
    );
    const result = await verify(gamePath, baseline, {
      fullVerify: true,
      limits: { ...LIMITS, hashSampleFiles: 0 },
    });
    expect(result.outcomes.get("a.bsa")).toMatchObject({
      kind: "modified",
      by: "sampled_chunk",
      fileSampleWouldMiss: true,
    });
  });

  it("rejects when cancelled", async () => {
    const { gamePath, baseline } = setup({ "a.bsa": ORIGINAL }, { "a.bsa": ORIGINAL });
    const controller = new AbortController();
    controller.abort();
    await expect(verify(gamePath, baseline, { signal: controller.signal })).rejects.toThrow(
      /aborted/,
    );
  });
});
