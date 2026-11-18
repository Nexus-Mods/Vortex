import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput, GameFolderCheckResult } from "@vortex/shared/ipc";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logging", () => ({ log: vi.fn<() => void>() }));

import { runGameFolderCheck } from "./run";
import { buildManifest, type ITestFile } from "./testManifest";

const sha1 = (data: string): string => createHash("sha1").update(data).digest("hex");

const testFile = (name: string, content: string, flags = 0): ITestFile => ({
  name,
  size: content.length,
  flags,
  sha1: sha1(content),
  chunks: [{ sha1: sha1(content), offset: 0, size: content.length }],
});

const STEAM_FILES = { "game.exe": "MZ the game", "Data\\main.pak": "game data" };

/** A Steam install with one depot whose manifest lists STEAM_FILES, and a game folder. */
function makeInstall(
  diskFiles: Record<string, string>,
  overrides: Partial<GameFolderCheckInput> = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "gfc-run-"));
  const steamPath = path.join(root, "steam");
  const steamapps = path.join(root, "library", "steamapps");
  const gamePath = path.join(steamapps, "common", "Game");
  mkdirSync(path.join(steamPath, "depotcache"), { recursive: true });
  mkdirSync(gamePath, { recursive: true });
  writeFileSync(path.join(steamapps, "appmanifest_100.acf"), '"AppState" {}');
  writeFileSync(
    path.join(steamPath, "depotcache", "101_202.manifest"),
    buildManifest(
      101,
      "202",
      Object.entries(STEAM_FILES).map(([name, content]) => testFile(name, content)),
    ),
  );
  for (const [relPath, content] of Object.entries(diskFiles)) {
    const full = path.join(gamePath, ...relPath.split("\\"));
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const input: GameFolderCheckInput = {
    gameId: VortexGameId("game"),
    appId: 100,
    buildId: 5,
    targetBuildId: 5,
    steamPath,
    gamePath,
    depots: [{ depotId: 101, manifestId: "202" }],
    fullVerify: false,
    limits: {
      maxDurationMs: 60_000,
      maxBytes: 1024 ** 3,
      hashConcurrency: 4,
      hashSampleExecutables: 1000,
      hashSampleFiles: 1000,
      maxUnknownPaths: 1000,
    },
    ...overrides,
  };
  return { input, gamePath };
}

const run = async (input: GameFolderCheckInput) =>
  runGameFolderCheck(input, new AbortController().signal);

function counts(result: GameFolderCheckResult) {
  if (result.status !== "checked") throw new Error(`expected a check, got ${result.status}`);
  return result.counts;
}

describe("runGameFolderCheck", () => {
  it("keeps local paths out of the result", async () => {
    const { input } = makeInstall(STEAM_FILES);
    const { result } = await run(input);
    expect(result.input).not.toHaveProperty("steamPath");
    expect(result.input).not.toHaveProperty("gamePath");
    expect(JSON.stringify(result)).not.toContain(input.gamePath.replaceAll("\\", "\\\\"));
  });

  it("finds a vanilla folder clean", async () => {
    const { input } = makeInstall(STEAM_FILES);
    const { result } = await run(input);
    expect(result.status).toBe("checked");
    expect(counts(result).steamFiles.verified.files).toBe(2);
    expect(counts(result).unknown.files).toBe(0);
    expect(counts(result).steamFiles.modified.files).toBe(0);
  });

  it("finds unknown, modified and missing files", async () => {
    const { input } = makeInstall({
      "game.exe": "MZ the gamf",
      "SKSE\\loader.dll": "user's file",
    });
    const { result, files } = await run(input);
    expect(counts(result).steamFiles.modified.files).toBe(1);
    // a one-chunk file is always in the sample
    expect(counts(result).modifiedBy.sampled_chunk).toBe(1);
    expect(counts(result).steamFiles.missing.files).toBe(1);
    expect(counts(result).unknown).toEqual({ files: 1, bytes: "user's file".length });
    expect(files.find((file) => file.kind === "missing")?.relPath).toBe("Data\\main.pak");
  });

  it("rebuilds the manage-time state after a deploy", async () => {
    const { input, gamePath } = makeInstall({
      "game.exe": "MZ a mod's exe",
      "game.exe.vortex_backup": STEAM_FILES["game.exe"],
      "Data\\main.pak": STEAM_FILES["Data\\main.pak"],
      "Data\\mod.pak": "a mod",
      "Data\\patch.pak": "deployed where nothing was",
      "readme.txt.vortex_backup": "the user's readme",
      "readme.txt": "a mod's readme",
    });
    const deployed = ["game.exe", "Data\\mod.pak", "Data\\patch.pak", "readme.txt"];
    const now = Date.now();
    for (const relPath of deployed) {
      const full = path.join(gamePath, ...relPath.split("\\"));
      utimesSync(full, now / 1000, now / 1000);
    }
    writeFileSync(
      path.join(gamePath, "vortex.deployment.json"),
      JSON.stringify({
        targetPath: gamePath,
        files: deployed.map((relPath) => ({ relPath, source: "mod", time: now })),
      }),
    );

    const { result } = await run(input);
    const found = counts(result);
    expect(result.status === "checked" && result.deployedBeforeCheck).toBe(true);
    // the backup stands in for the deployed exe
    expect(found.steamFiles.verified.files).toBe(2);
    expect(found.steamFiles.modified.files).toBe(0);
    // the backed-up readme was the user's; the deployed files and the manifest are Vortex's
    expect(found.unknown.files).toBe(1);
    expect(found.vortex.files).toBe(5);
    expect(found.vortexChangedSinceDeploy.files).toBe(0);
  });

  it("treats a deployed Steam path with no backup as missing", async () => {
    const { input, gamePath } = makeInstall({
      "game.exe": STEAM_FILES["game.exe"],
      "Data\\main.pak": "a mod's pak",
    });
    writeFileSync(
      path.join(gamePath, "vortex.deployment.json"),
      JSON.stringify({ files: [{ relPath: "Data\\main.pak", source: "mod", time: 0 }] }),
    );
    const { result } = await run(input);
    expect(counts(result).steamFiles.missing.files).toBe(1);
    expect(counts(result).steamFiles.modified.files).toBe(0);
  });

  it("counts deployed files changed after their deploy", async () => {
    const { input, gamePath } = makeInstall({ ...STEAM_FILES, "mods\\settings.json": "rewritten" });
    writeFileSync(
      path.join(gamePath, "vortex.deployment.json"),
      JSON.stringify({ files: [{ relPath: "mods\\settings.json", source: "mod", time: 0 }] }),
    );
    const { result } = await run(input);
    expect(counts(result).vortexChangedSinceDeploy.files).toBe(1);
  });

  it("has no baseline without the depot manifest", async () => {
    const { input } = makeInstall(STEAM_FILES, { depots: [{ depotId: 101, manifestId: "999" }] });
    const { result } = await run(input);
    expect(result).toMatchObject({ status: "no_baseline", reason: "manifest_missing" });
  });

  it("has no baseline while Steam is updating the game", async () => {
    const { input } = makeInstall(STEAM_FILES, { targetBuildId: 6 });
    const { result } = await run(input);
    expect(result).toMatchObject({ status: "no_baseline", reason: "steam_updating" });
  });
});
