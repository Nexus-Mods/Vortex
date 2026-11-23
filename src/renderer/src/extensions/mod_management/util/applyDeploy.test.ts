import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import {
  parseError,
  VortexDeploymentMethodId,
  VortexGameId,
  VortexModId,
  VortexModTypeId,
  VortexProfileId,
} from "@vortex/shared";
import { ChaosFS, QualifiedPath } from "@vortex/shared/filesystem";
import { expect, onTestFinished, vi } from "vitest";

import type * as PlannerPlanEvent from "../../analytics/utils/plannerPlanEvent";
import type * as NexusIntegrationUtil from "../../nexus_integration/util";
import type * as ActivationStore from "./activationStore";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));
// the Nexus game list comes from the network
vi.mock("../../nexus_integration/util", async (importOriginal) => ({
  ...(await importOriginal<typeof NexusIntegrationUtil>()),
  nexusGames: () => [{ domain_name: "skyrimspecialedition", id: 1704 }],
}));
vi.mock("../../analytics/utils/plannerPlanEvent", async (importOriginal) => ({
  ...(await importOriginal<typeof PlannerPlanEvent>()),
  emitPlannerPlanEvent: vi.fn(() => Promise.resolve()),
}));
// the real manifest save, able to fail as when another program holds the manifest
vi.mock("./activationStore", async (importOriginal) => {
  const actual = await importOriginal<typeof ActivationStore>();
  return { ...actual, saveActivation: vi.fn(actual.saveActivation) };
});

import { makeProfileMod, makeStagedMod } from "../../../test-utils/builders";
import { hashFile, makeResolvableGame } from "../../../test-utils/deployedGame";
import { enableModPipelineFlag } from "../../../test-utils/flags";
import { installInMemoryFS } from "../../../test-utils/fsApi";
import { test } from "../../../test-utils/harnessTest";
import { newJournal, unreadableJournal } from "../../../test-utils/journal";
import { writeInto } from "../../../test-utils/tempDir";
import type { IMergeResultByType } from "../modMerging";
import { saveActivation } from "./activationStore";
import type { RunOptions } from "./apply/apply";
import { JournalPhase, type JournalStorage } from "./apply/journal";
import {
  DeploymentPlanning,
  deploymentPlanningFor,
  planAndApplyDeployment,
  progressBarFor,
  settleLeftoverDeployment,
} from "./applyDeploy";
import { DeployOrchestrator } from "./DeployOrchestrator";
import { LockfileContributions } from "./lockfileContributions";

const MOD_ID = VortexModId("mod");

/** A game with one enabled staged mod, mod.esp, not yet deployed, and an orchestrator for it. */
async function makeGameWithUndeployedMod() {
  const game = await makeResolvableGame();
  const mod = makeStagedMod(MOD_ID);
  const stagedPath = path.join(game.stagingPath, mod.installationPath, "mod.esp");
  const deployedPath = path.join(game.dataPath, "mod.esp");
  // the resolver hashes staging from the disk
  await writeInto(game.stagingPath, path.join(mod.installationPath, "mod.esp"));
  // manifests are written into the game's folders on the disk
  await mkdir(game.dataPath, { recursive: true });
  const disk = installInMemoryFS((builder) => {
    builder.file(QualifiedPath.fromNative(stagedPath), { type: "text", data: "mod" });
    builder.dir(QualifiedPath.fromNative(game.dataPath));
  });
  onTestFinished(disk.restore);
  game.setState((draft) => {
    draft.persistent.mods[game.gameId] = { [mod.id]: mod };
    draft.persistent.profiles[game.profileId].modState = {
      [mod.id]: makeProfileMod({ enabled: true }),
    };
  });
  const orchestrator = new DeployOrchestrator(game.api, hashFile, new LockfileContributions());
  /** Plans and applies the profile's deployment with this journal, merge result and profile. */
  const planAndApplyWith = async (
    journal: JournalStorage,
    {
      mergeResult = {},
      profileId = VortexProfileId(game.profileId),
      onProgress,
    }: {
      mergeResult?: Record<VortexModTypeId, IMergeResultByType>;
      profileId?: VortexProfileId;
      onProgress?: RunOptions["onProgress"];
    } = {},
  ) =>
    planAndApplyDeployment(game.api, orchestrator, {
      profileId,
      mergeResult,
      journal,
      journalFile: JOURNAL_FILE,
      keptFolder: path.join(game.stagingPath, "..", "kept"),
      onProgress,
    });
  const isModFileDeployed = async () =>
    (await disk.fs.stat(QualifiedPath.fromNative(deployedPath))).exists;
  return { game, disk, planAndApplyWith, isModFileDeployed };
}

/** The journal file the failure messages name. */
const JOURNAL_FILE = path.join("userData", "skyrimse", "apply", "journal.ndjson");

test("a deployment through Apply links the mod's files, saves their manifest and gives the entries saved", async () => {
  const { game, planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();

  const savedManifestFiles = await planAndApplyWith(await newJournal());

  expect(await isModFileDeployed()).toBe(true);
  expect(await game.recordedFiles()).toEqual(["mod.esp"]);
  expect(savedManifestFiles.get(VortexModTypeId(""))).toEqual([
    expect.objectContaining({ relPath: "mod.esp", source: MOD_ID }),
  ]);
});

test("a deployment whose manifest another program holds for a moment still saves it and applies", async () => {
  const { game, planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();
  vi.mocked(saveActivation).mockRejectedValueOnce(
    Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" }),
  );

  await planAndApplyWith(await newJournal());

  expect(await isModFileDeployed()).toBe(true);
  expect(await game.recordedFiles()).toEqual(["mod.esp"]);
});

test("a deployment Apply refuses fails, naming why, and leaves the disk as it was", async () => {
  const { planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();

  await expect(planAndApplyWith(await unreadableJournal())).rejects.toThrow(
    `Vortex didn't deploy, because the journal at ${JOURNAL_FILE} can't be used`,
  );

  expect(await isModFileDeployed()).toBe(false);
});

test("a deployment Apply rolls back fails, naming the step that failed", async () => {
  const { disk, planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();
  window.api = {
    ...window.api,
    fs: new ChaosFS(disk.fs, [
      { fault: { kind: "os:generic", originalCode: "EBUSY" }, op: "createLink", times: Infinity },
    ]),
  };

  await expect(planAndApplyWith(await newJournal())).rejects.toThrow(
    /failed at step 1, LINK .*mod\.esp, .*, and was undone/,
  );

  expect(await isModFileDeployed()).toBe(false);
});

test("a deployment whose journal can't be ended fails, naming the cause and the journal", async () => {
  const { planAndApplyWith } = await makeGameWithUndeployedMod();
  const journal = await newJournal();

  await expect(
    planAndApplyWith({ ...journal, remove: () => Promise.reject(new Error("held by a scanner")) }),
  ).rejects.toThrow(
    `couldn't finish: held by a scanner; the journal at ${JOURNAL_FILE} records what changed`,
  );
});

test("a deployment with merged files fails before Apply runs", async () => {
  const { planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();

  await expect(
    planAndApplyWith(await newJournal(), {
      mergeResult: { [VortexModTypeId("")]: { usedInMerge: ["mod.esp"], mergeInfluences: {} } },
    }),
  ).rejects.toThrow("merged");

  expect(await isModFileDeployed()).toBe(false);
});

test("a deployment that can't be planned fails, with no file work", async () => {
  const { planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();

  await expect(
    planAndApplyWith(await newJournal(), { profileId: VortexProfileId("no-such-profile") }),
  ).rejects.toThrow("couldn't be planned");

  expect(await isModFileDeployed()).toBe(false);
});

test("a run stopped before its journal recorded a step is finished by settling, which saves its manifest", async () => {
  const { game, planAndApplyWith, isModFileDeployed } = await makeGameWithUndeployedMod();
  const journal = await newJournal();
  // as a kill leaves it: the journal holds the run's steps and nothing after them
  await planAndApplyWith({ ...journal, append: () => Promise.reject(new Error("killed")) }).catch(
    () => undefined,
  );
  expect(await isModFileDeployed()).toBe(false);

  await settleLeftoverDeployment(game.api, VortexGameId(game.gameId), {
    journalFile: JOURNAL_FILE,
    journal,
  });

  expect(await isModFileDeployed()).toBe(true);
  expect(await game.recordedFiles()).toEqual(["mod.esp"]);
  expect(await journal.read()).toBeUndefined();
  expect(game.notifications).toContainEqual(
    expect.objectContaining({ message: "Interrupted deployment finished" }),
  );
});

test("settling reports the progress of the run it finishes", async () => {
  const { game, planAndApplyWith } = await makeGameWithUndeployedMod();
  const journal = await newJournal();
  await planAndApplyWith({ ...journal, append: () => Promise.reject(new Error("killed")) }).catch(
    () => undefined,
  );
  const onProgress = vi.fn<NonNullable<RunOptions["onProgress"]>>();

  await settleLeftoverDeployment(game.api, VortexGameId(game.gameId), {
    journalFile: JOURNAL_FILE,
    journal,
    onProgress,
  });

  expect(onProgress).toHaveBeenLastCalledWith(1, 1, JournalPhase.Applying);
});

test("a deployment through Apply reports its progress as it links the mod's files", async () => {
  const { planAndApplyWith } = await makeGameWithUndeployedMod();
  const onProgress = vi.fn<NonNullable<RunOptions["onProgress"]>>();

  await planAndApplyWith(await newJournal(), { onProgress });

  expect(onProgress).toHaveBeenLastCalledWith(1, 1, JournalPhase.Applying);
});

test("Apply's progress moves the progress bar a whole percent at a time, labelled by its phase", () => {
  const report = vi.fn<(label: string, percent: number) => void>();
  const onProgress = progressBarFor(
    report,
    { [JournalPhase.Applying]: "Deploying mods", [JournalPhase.RollingBack]: "Undoing" },
    50,
    99,
  );

  for (let done = 1; done <= 1000; done++) {
    onProgress(done, 1000, JournalPhase.Applying);
  }
  onProgress(1, 2, JournalPhase.RollingBack);
  onProgress(2, 2, JournalPhase.RollingBack);

  const deployingPercents = report.mock.calls
    .filter(([label]) => label === "Deploying mods")
    .map(([, percent]) => percent);
  expect(deployingPercents).toEqual(Array.from({ length: 50 }, (_, offset) => 50 + offset));
  expect(report.mock.calls.slice(-2)).toEqual([
    ["Undoing", 74],
    ["Undoing", 99],
  ]);
});

test("settling a game with no journal changes nothing", async () => {
  const { game, isModFileDeployed } = await makeGameWithUndeployedMod();

  await settleLeftoverDeployment(game.api, VortexGameId(game.gameId), {
    journalFile: JOURNAL_FILE,
    journal: await newJournal(),
  });

  expect(await isModFileDeployed()).toBe(false);
  expect(game.notifications).toEqual([]);
});

test("a journal settling can't use stops the game's deployments and purges", async () => {
  const { game } = await makeGameWithUndeployedMod();
  const journal = await unreadableJournal();

  const settling = settleLeftoverDeployment(game.api, VortexGameId(game.gameId), {
    journalFile: JOURNAL_FILE,
    journal,
  });

  expect(parseError(await settling.catch((err: unknown) => err)).data.kind).toBe(
    "deployment:interrupted-run-unsettled",
  );
  await expect(settling).rejects.toThrow(
    `Vortex can't settle an interrupted deployment, because the journal at ${JOURNAL_FILE} can't ` +
      "be used, so it won't deploy or purge this game",
  );
  expect(await journal.read()).toBeDefined();
});

const SKYRIM_SE = VortexGameId("skyrimse");
const HARDLINK = VortexDeploymentMethodId("hardlink_activator");
const SYMLINK = VortexDeploymentMethodId("symlink_activator");

test("a Skyrim SE deployment by hardlink goes through Apply with the mod pipeline flag on", () => {
  enableModPipelineFlag();

  expect(deploymentPlanningFor(SKYRIM_SE, HARDLINK)).toBe(DeploymentPlanning.ThroughApply);
  expect(deploymentPlanningFor(SKYRIM_SE, SYMLINK)).toBe(DeploymentPlanning.BesideTodaysDeployment);
  expect(deploymentPlanningFor(VortexGameId("fallout4"), HARDLINK)).toBe(
    DeploymentPlanning.Unplanned,
  );
});

test("with the mod pipeline flag off, a Skyrim SE deployment is planned only in a dev build", () => {
  expect(deploymentPlanningFor(SKYRIM_SE, HARDLINK)).toBe(DeploymentPlanning.Unplanned);

  vi.stubEnv("NODE_ENV", "development");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });

  expect(deploymentPlanningFor(SKYRIM_SE, HARDLINK)).toBe(
    DeploymentPlanning.BesideTodaysDeployment,
  );
});
