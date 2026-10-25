import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { FolderCheckInput } from "@vortex/shared/ipc";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logging", () => ({ log: vi.fn() }));

import {
  FolderCheckUnavailable,
  loadBaseFiles,
  readDeployments,
  runFolderCheck,
  walkFolder,
} from "./scan";
import { buildManifest, type ITestFile } from "./testManifest";

const sha1Of = async (content: string) =>
  (await import("node:crypto")).createHash("sha1").update(content).digest("hex");

/** Manifest chunks of `size` bytes for the given content, as Steam lists them. */
const chunksOf = async (content: string, size: number) => {
  const result: { sha1: string; offset: number; size: number }[] = [];
  for (let offset = 0; offset < content.length; offset += size) {
    const part = content.slice(offset, offset + size);
    result.push({ sha1: await sha1Of(part), offset, size: part.length });
  }
  return result;
};

// ten bytes in five chunks; a quick check reads chunks 0, 1, 3 and 4
const ORIGINAL = "aabbccddee";

/** A Steam folder with a depotcache and a game folder holding the given files. */
function makeTree(gameFiles: Record<string, string>, depotFiles: ITestFile[]) {
  const root = mkdtempSync(path.join(tmpdir(), "foldercheck-"));
  const steamPath = path.join(root, "steam");
  const gamePath = path.join(root, "game");
  mkdirSync(path.join(steamPath, "depotcache"), { recursive: true });
  writeFileSync(
    path.join(steamPath, "depotcache", "100_200.manifest"),
    buildManifest(100, "200", depotFiles),
  );
  for (const [relPath, content] of Object.entries(gameFiles)) {
    const full = path.join(gamePath, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const input: FolderCheckInput = {
    appId: 1,
    buildId: 2,
    steamPath,
    gamePath,
    depots: [{ depotId: 100, manifestId: "200" }],
  };
  return { steamPath, gamePath, input };
}

describe("loadBaseFiles", () => {
  it("names the depot and manifest when the file list is missing", async () => {
    const steamPath = mkdtempSync(path.join(tmpdir(), "foldercheck-"));
    mkdirSync(path.join(steamPath, "depotcache"));
    writeFileSync(
      path.join(steamPath, "depotcache", "1091501_3389237510439361019.manifest"),
      buildManifest(1091501, "3389237510439361019", []),
    );
    const promise = loadBaseFiles({
      appId: 1091500,
      buildId: 1,
      steamPath,
      gamePath: steamPath,
      depots: [{ depotId: 1091501, manifestId: "2461377369266892508" }],
    });
    await expect(promise).rejects.toThrow(FolderCheckUnavailable);
    await expect(promise).rejects.toThrow(/1091501.*2461377369266892508/);
  });
});

describe("readDeployments", () => {
  it("resolves deployment entries against each manifest's target path", async () => {
    const gamePath = mkdtempSync(path.join(tmpdir(), "foldercheck-"));
    mkdirSync(path.join(gamePath, "Data"));
    writeFileSync(
      path.join(gamePath, "Data", "vortex.deployment.json"),
      JSON.stringify({
        targetPath: path.join(gamePath, "Data"),
        files: [{ relPath: "SKSE\\a.bin", source: "m", target: "", time: 1 }],
      }),
    );
    writeFileSync(
      path.join(gamePath, "vortex.deployment.dinput.json"),
      JSON.stringify({
        targetPath: gamePath,
        files: [
          { relPath: "dinput8.dll", source: "m", target: "", time: 2 },
          { relPath: "x.dll", source: "m", target: "sub", time: 3 },
          { relPath: "..\\outside.dll", source: "m", time: 4 },
        ],
      }),
    );
    const entries = await readDeployments(gamePath, await walkFolder(gamePath));
    expect(entries.map((e) => e.relPath).toSorted()).toEqual([
      path.join("Data", "SKSE", "a.bin"),
      "dinput8.dll",
      path.join("sub", "x.dll"),
    ]);
  });

  it("falls back to the manifest's own folder when its target path is elsewhere", async () => {
    // Vortex may manage the game through a junction or subst path
    const gamePath = mkdtempSync(path.join(tmpdir(), "foldercheck-"));
    mkdirSync(path.join(gamePath, "Data"));
    writeFileSync(
      path.join(gamePath, "Data", "vortex.deployment.json"),
      JSON.stringify({
        targetPath: "X:\\Games\\Skyrim\\Data",
        files: [{ relPath: "SKSE\\a.bin", source: "m", target: "", time: 1 }],
      }),
    );
    const entries = await readDeployments(gamePath, await walkFolder(gamePath));
    expect(entries.map((e) => e.relPath)).toEqual([path.join("Data", "SKSE", "a.bin")]);
  });

  it("skips a deployment manifest it can't read", async () => {
    const gamePath = mkdtempSync(path.join(tmpdir(), "foldercheck-"));
    mkdirSync(path.join(gamePath, "Data"));
    writeFileSync(path.join(gamePath, "Data", "vortex.deployment.json"), "{ not json");
    writeFileSync(
      path.join(gamePath, "vortex.deployment.dinput.json"),
      JSON.stringify({
        targetPath: gamePath,
        files: [{ relPath: "dinput8.dll", time: 2 }, { time: 3 }],
      }),
    );
    const entries = await readDeployments(gamePath, await walkFolder(gamePath));
    expect(entries.map((e) => e.relPath)).toEqual(["dinput8.dll"]);
  });
});

describe("runFolderCheck", () => {
  it("marks a hash mismatch as modified", async () => {
    const { input } = makeTree({ "game.exe": "hello" }, [
      { name: "game.exe", size: 5, sha1: "0000000000000000000000000000000000000000" },
    ]);
    const result = await runFolderCheck(input, () => undefined);
    expect(result.files).toEqual([
      expect.objectContaining({ relPath: "game.exe", bucket: "game", modified: true }),
    ]);
  });

  it("leaves matching files unmodified", async () => {
    const { input } = makeTree({ "game.exe": "hello" }, [
      { name: "game.exe", size: 5, sha1: await sha1Of("hello") },
    ]);
    const result = await runFolderCheck(input, () => undefined);
    expect(result.files[0]?.modified).toBeUndefined();
  });

  it("records unreadable files and still finishes", async () => {
    const { input } = makeTree({ "a.exe": "hello", "b.exe": "world" }, [
      { name: "a.exe", size: 5, sha1: await sha1Of("hello") },
      { name: "b.exe", size: 5, sha1: "0000000000000000000000000000000000000000" },
    ]);
    const hash = (p: string) =>
      p.endsWith("b.exe") ? Promise.reject(new Error("EBUSY")) : sha1Of("hello");
    const result = await runFolderCheck(input, () => undefined, "quick", hash);
    expect(result.unreadable).toEqual(["b.exe"]);
    expect(result.files.find((f) => f.relPath === "b.exe")?.modified).toBeUndefined();
  });

  it("reports listing then hashing progress", async () => {
    const { input } = makeTree({ "a.exe": "hello", "b.exe": "world!" }, [
      { name: "a.exe", size: 5, sha1: await sha1Of("hello") },
      { name: "b.exe", size: 6, sha1: await sha1Of("world!") },
    ]);
    const calls: { phase: string; bytesDone: number; bytesTotal: number }[] = [];
    await runFolderCheck(input, (s) => calls.push({ ...s }));
    expect(calls[0]?.phase).toBe("listing");
    const last = calls[calls.length - 1];
    expect(last?.phase).toBe("hashing");
    expect(last?.bytesTotal).toBe(11);
    expect(last?.bytesDone).toBe(11);
  });

  it("quick check compares sampled chunks and misses edits between them", async () => {
    const chunks = await chunksOf(ORIGINAL, 2);
    const { input } = makeTree({ "first.bsa": "XXbbccddee", "middle.bsa": "aabbXXddee" }, [
      { name: "first.bsa", size: 10, sha1: await sha1Of(ORIGINAL), chunks },
      { name: "middle.bsa", size: 10, sha1: await sha1Of(ORIGINAL), chunks },
    ]);
    const quick = await runFolderCheck(input, () => undefined);
    expect(quick.mode).toBe("quick");
    expect(quick.files.find((f) => f.relPath === "first.bsa")?.modified).toBe(true);
    expect(quick.files.find((f) => f.relPath === "middle.bsa")?.modified).toBeUndefined();

    const full = await runFolderCheck(input, () => undefined, "full");
    expect(full.mode).toBe("full");
    expect(full.files.find((f) => f.relPath === "middle.bsa")?.modified).toBe(true);
  });

  it("quick check hashes executables and libraries whole", async () => {
    const chunks = await chunksOf(ORIGINAL, 2);
    const { input } = makeTree({ "game.exe": "aabbXXddee", "engine.dll": "aabbXXddee" }, [
      { name: "game.exe", size: 10, sha1: await sha1Of(ORIGINAL), chunks },
      { name: "engine.dll", size: 10, sha1: await sha1Of(ORIGINAL), chunks },
    ]);
    const result = await runFolderCheck(input, () => undefined);
    expect(result.files.every((f) => f.modified === true)).toBe(true);
  });

  it("quick check hashes files whole when the manifest has no chunks", async () => {
    const { input } = makeTree({ "a.bsa": "aabbXXddee" }, [
      { name: "a.bsa", size: 10, sha1: await sha1Of(ORIGINAL) },
    ]);
    const result = await runFolderCheck(input, () => undefined);
    expect(result.files[0]?.modified).toBe(true);
  });

  it("counts only the bytes a quick check reads", async () => {
    const { input } = makeTree({ "a.bsa": ORIGINAL, "b.exe": "hello" }, [
      {
        name: "a.bsa",
        size: 10,
        sha1: await sha1Of(ORIGINAL),
        chunks: await chunksOf(ORIGINAL, 2),
      },
      { name: "b.exe", size: 5, sha1: await sha1Of("hello") },
    ]);
    let last = { bytesDone: 0, bytesTotal: 0 };
    await runFolderCheck(input, (s) => (last = s));
    expect(last).toMatchObject({ bytesDone: 13, bytesTotal: 13 });
  });
});
