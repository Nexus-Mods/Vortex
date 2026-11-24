import { expect, test, vi } from "vitest";

vi.mock("../../../logging", () => ({ log: vi.fn() }));

import { log } from "../../../logging";
import { makeApiHarness, makeDeclaredFile } from "../../../test-utils/builders";
import { makeGeneratedFileSource } from "../../../test-utils/lockfileBuilders";
import { checksum } from "../../../util/checksum";
import {
  LockfileContributions,
  type IGeneratedFile,
  type LockfileContribution,
} from "./lockfileContributions";

const state = makeApiHarness().getState();
const always = () => true;

/** The lockfile entry a declared file becomes. */
const generatedFrom = (declared: IGeneratedFile) =>
  makeGeneratedFileSource({
    destinationPath: declared.destinationPath,
    fileHash: checksum(Buffer.from(declared.content)),
  });

test("a contributed file comes back with its hash and / separators", async () => {
  const declared = makeDeclaredFile({
    destinationPath: "C:\\AppData\\Skyrim Special Edition\\plugins.txt",
  });
  const contributions = new LockfileContributions();
  contributions.register("plugin-lists", always, () => Promise.resolve([declared]));

  expect(await contributions.generatedFiles(state, "skyrimse", "profile-1")).toEqual([
    {
      ...generatedFrom(declared),
      destinationPath: "C:/AppData/Skyrim Special Edition/plugins.txt",
    },
  ]);
});

test("a contribution that fails is reported with its contributor and leaves the others' files in", async () => {
  const contributions = new LockfileContributions();
  contributions.register("broken-extension", always, () => Promise.reject(new Error("unreadable")));
  contributions.register("plugin-lists", always, () => Promise.resolve([makeDeclaredFile()]));

  expect(await contributions.generatedFiles(state, "skyrimse", "profile-1")).toEqual([
    generatedFrom(makeDeclaredFile()),
  ]);
  expect(log).toHaveBeenCalledWith("warn", "lockfile contribution failed", {
    contributor: "broken-extension",
    gameMode: "skyrimse",
    error: "unreadable",
  });
});

test("a contribution is asked for the game and profile being resolved", async () => {
  const generate = vi.fn<LockfileContribution>(() => Promise.resolve<IGeneratedFile[]>([]));
  const contributions = new LockfileContributions();
  contributions.register("plugin-lists", always, generate);

  await contributions.generatedFiles(state, "skyrimse", "profile-1");

  expect(generate).toHaveBeenCalledWith(state, "skyrimse", "profile-1");
});

test("a contribution whose condition does not match the game is not asked", async () => {
  const generate = vi.fn<LockfileContribution>(() => Promise.resolve([makeDeclaredFile()]));
  const contributions = new LockfileContributions();
  contributions.register("plugin-lists", (_state, gameMode) => gameMode === "fallout4", generate);

  expect(await contributions.generatedFiles(state, "skyrimse", "profile-1")).toEqual([]);
  expect(generate).not.toHaveBeenCalled();
});

test("a condition that throws is reported like a failing contribution", async () => {
  const generate = vi.fn<LockfileContribution>(() => Promise.resolve([makeDeclaredFile()]));
  const contributions = new LockfileContributions();
  contributions.register(
    "broken-extension",
    () => {
      throw new Error("no game support");
    },
    generate,
  );

  expect(await contributions.generatedFiles(state, "skyrimse", "profile-1")).toEqual([]);
  expect(log).toHaveBeenCalledWith("warn", "lockfile contribution failed", {
    contributor: "broken-extension",
    gameMode: "skyrimse",
    error: "no game support",
  });
  expect(generate).not.toHaveBeenCalled();
});

test("a path two contributors declare is rejected, naming both of them", async () => {
  const contributions = new LockfileContributions();
  contributions.register("plugin-lists", always, () => Promise.resolve([makeDeclaredFile()]));
  contributions.register("game-extension", always, () => Promise.resolve([makeDeclaredFile()]));

  await expect(contributions.generatedFiles(state, "skyrimse", "profile-1")).rejects.toThrow(
    "declared by both plugin-lists and game-extension",
  );
});
