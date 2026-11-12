import * as path from "node:path";

import { DestinationState, FileSourceKind, OperationKind } from "@nexusmods/mod-pipeline";
import { VortexGameId, VortexModId, VortexProfileId } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { expect, onTestFinished, vi } from "vitest";

import type * as PlannerPlanEvent from "../../analytics/utils/plannerPlanEvent";
import type * as NexusIntegrationUtil from "../../nexus_integration/util";

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

import {
  makeDeployedFile,
  makeDeploymentFailure,
  makeProfile,
  makeProfileMod,
  makeStagedMod,
} from "../../../test-utils/builders";
import { hashFile, makeResolvableGame } from "../../../test-utils/deployedGame";
import { installInMemoryFS } from "../../../test-utils/fsApi";
import { test } from "../../../test-utils/harnessTest";
import type { IDeployedGameHarness } from "../../../test-utils/harnessTypes";
import { newJournal, unreadableJournal } from "../../../test-utils/journal";
import { writeInto } from "../../../test-utils/tempDir";
import { emitPlannerPlanEvent } from "../../analytics/utils/plannerPlanEvent";
import { addDeploymentFailures } from "../actions/session";
import type { IMod } from "../types/IMod";
import { ApplyStatus } from "./apply/apply";
import type { JournalStorage } from "./apply/journal";
import type { DeploymentPlan } from "./deploymentPlan";
import { registerDeployOrchestrator } from "./DeployOrchestrator";
import { lastPlanOf } from "./lastPlans";
import { registerLockfileContribution } from "./resolveLockFile";
import { toPortablePath } from "./resolverInput";
import { ReasonCode } from "./shadowComparison";

const MOD_ID = VortexModId("mod");
const OTHER_MOD_ID = VortexModId("other-mod");

/**
 * A game with one staged mod, mod.esp, enabled and on disk when `enabled`, and `otherMods` staged
 * disabled with their own mod.esp, with an orchestrator following its deployment events.
 */
async function makeGameWithStagedMod(enabled: boolean, otherMods: IMod[] = []) {
  const game = await makeResolvableGame();
  const mod = makeStagedMod(MOD_ID);
  const stagedMods = [mod, ...otherMods];
  const stagedPathOf = (stagedMod: IMod) =>
    path.join(game.stagingPath, stagedMod.installationPath, "mod.esp");
  const deployedPath = path.join(game.dataPath, "mod.esp");
  // the resolver lists staging through window.api.fs and hashes it from the disk, where each mod's
  // copy holds its own path
  for (const stagedMod of stagedMods) {
    await writeInto(game.stagingPath, path.join(stagedMod.installationPath, "mod.esp"));
  }
  const disk = installInMemoryFS((builder) => {
    for (const stagedMod of stagedMods) {
      builder.file(QualifiedPath.fromNative(stagedPathOf(stagedMod)), {
        type: "text",
        data: "mod",
      });
    }
    builder.dir(QualifiedPath.fromNative(game.dataPath));
    if (enabled) {
      builder.file(QualifiedPath.fromNative(deployedPath), { type: "text", data: "mod" });
    }
  });
  onTestFinished(disk.restore);
  game.setState((draft) => {
    draft.persistent.mods[game.gameId] = Object.fromEntries(
      stagedMods.map((stagedMod) => [stagedMod.id, stagedMod]),
    );
    draft.persistent.profiles[game.profileId].modState = Object.fromEntries(
      stagedMods.map((stagedMod) => [
        stagedMod.id,
        makeProfileMod({ enabled: enabled && stagedMod === mod }),
      ]),
    );
  });
  const hashStagedFile = vi.fn(hashFile);
  const orchestrator = registerDeployOrchestrator(game.api, hashStagedFile);
  const activeProfileId = VortexProfileId(game.profileId);
  /** Writes `text` to mod.esp's destination, as a deployment or purge outside the plan does. */
  const writeDeployed = (text: string) =>
    disk.fs.writeFile(QualifiedPath.fromNative(deployedPath), new TextEncoder().encode(text));
  /** Plans a profile's deployment, the game's active one by default. */
  const plan = (profileId = activeProfileId) => orchestrator.plan(profileId);
  /** Deploys a profile as a deployment does: plans, then finishes. */
  const deploy = async (profileId = activeProfileId) => {
    const planned = await plan(profileId);
    await game.emitAndAwait("did-deploy", profileId, {});
    return planned;
  };
  /** Deploys the active profile through Apply on the game's disk: plans, applies, then finishes. */
  const applyDeploy = async (journal: JournalStorage) => {
    const planned = await plan();
    if (planned === undefined) {
      throw new Error("the deployment has no plan");
    }
    const result = await orchestrator.apply(planned, {
      fs: disk.fs,
      journal,
      keptPathOf: (_destinationPath, runId, entryIndex) =>
        path.join(game.stagingPath, "kept", runId, String(entryIndex)),
    });
    await game.emitAndAwait("did-deploy", activeProfileId, {});
    return result;
  };
  return {
    game,
    disk,
    deployedPath,
    mod,
    stagedPathOf,
    writeDeployed,
    hashStagedFile,
    plan,
    deploy,
    applyDeploy,
  };
}

/** Where a plan says the file of each of its operations of `kind` is staged. */
function stagedPathsOf(
  plan: DeploymentPlan | undefined,
  kind: typeof OperationKind.Link | typeof OperationKind.Unlink,
) {
  if (plan === undefined) {
    return [];
  }
  return plan.destinations.flatMap(({ operations }) =>
    operations.flatMap((operation) =>
      "file" in operation && operation.kind === kind
        ? [plan.stagedFiles.pathOf(operation.file)]
        : [],
    ),
  );
}

/** Enables or disables a mod in the game's profile. */
const setModEnabled = (game: IDeployedGameHarness, modId: VortexModId, enabled: boolean) =>
  game.setState((draft) => {
    draft.persistent.profiles[game.profileId].modState[modId].enabled = enabled;
  });

/** Writes the manifest a deployment of `mod`'s mod.esp leaves. */
const saveModManifest = (game: IDeployedGameHarness, mod: IMod) =>
  game.saveManifest(
    [makeDeployedFile({ relPath: "mod.esp", source: mod.installationPath })],
    "hardlink_activator",
  );

/** The log calls with `message`. */
const loggedCalls = (message: string) =>
  vi.mocked(window.api).log.mock.calls.filter((call) => call[1] === message);

/** Each operation of a plan, as its kind and destination. */
const operationsOf = (plan: DeploymentPlan | undefined) =>
  (plan?.destinations ?? []).flatMap(({ destinationPath, operations }) =>
    operations.map(({ kind }) => ({ kind, path: destinationPath })),
  );

test("a deployment's plan leaves out the files contributions declare", async () => {
  const { game, deploy } = await makeGameWithStagedMod(true);
  const pluginsTxtPath = path.join(game.dataPath, "plugins.txt");
  registerLockfileContribution(
    () => true,
    () => Promise.resolve([{ destinationPath: pluginsTxtPath, content: Buffer.from("*mod.esp") }]),
  );

  const plan = await deploy();

  expect(plan?.lockfile.files.map(({ source }) => source)).toEqual([FileSourceKind.UserGenerated]);
});

test("a deployment's plan says where each file it links is staged", async () => {
  const { mod, stagedPathOf, deploy } = await makeGameWithStagedMod(true);

  const plan = await deploy();

  expect(stagedPathsOf(plan, OperationKind.Link)).toEqual([toPortablePath(stagedPathOf(mod))]);
});

test("a deployment's plan says where each file it unlinks is staged", async () => {
  const { game, mod, stagedPathOf, deploy } = await makeGameWithStagedMod(true);
  await saveModManifest(game, mod);
  setModEnabled(game, MOD_ID, false);

  const plan = await deploy();

  expect(stagedPathsOf(plan, OperationKind.Unlink)).toEqual([toPortablePath(stagedPathOf(mod))]);
});

test("a destination another mod takes over unlinks its old mod's copy and links the new one's", async () => {
  const otherMod = makeStagedMod(OTHER_MOD_ID, {
    rules: [{ type: "after", reference: { id: MOD_ID } }],
  });
  const { game, mod, stagedPathOf, deploy } = await makeGameWithStagedMod(true, [otherMod]);
  await deploy();
  setModEnabled(game, OTHER_MOD_ID, true);

  const plan = await deploy();

  expect(stagedPathsOf(plan, OperationKind.Unlink)).toEqual([toPortablePath(stagedPathOf(mod))]);
  expect(stagedPathsOf(plan, OperationKind.Link)).toEqual([toPortablePath(stagedPathOf(otherMod))]);
});

test("a deployment after a mod was deployed on its own plans nothing for that mod", async () => {
  const { game, mod, writeDeployed, deploy } = await makeGameWithStagedMod(false);
  await deploy();

  setModEnabled(game, MOD_ID, true);
  await game.emitAndAwait("will-deploy-single-mod", game.gameId, MOD_ID, true);
  await writeDeployed("mod");
  await saveModManifest(game, mod);

  expect(operationsOf(await deploy())).toEqual([]);
});

test("a deployment after mods were removed plans from the manifests the removal left", async () => {
  const { game, disk, deployedPath, deploy } = await makeGameWithStagedMod(true);
  await deploy();

  await game.emitAndAwait("will-remove-mods", game.gameId, [MOD_ID]);
  await disk.fs.delete(QualifiedPath.fromNative(deployedPath));
  game.setState((draft) => {
    delete draft.persistent.mods[game.gameId][MOD_ID];
  });
  vi.mocked(window.api).log.mockClear();
  await deploy();

  expect(loggedCalls("seeded previous lockfile from manifest")).toHaveLength(1);
});

test("a deployment after one that stopped partway plans from the manifests it left", async () => {
  const { game, mod, writeDeployed, plan, deploy } = await makeGameWithStagedMod(false);
  await deploy();

  setModEnabled(game, MOD_ID, true);
  await plan();
  // the deployment links the file and saves its manifest, then fails before it finishes
  await writeDeployed("mod");
  await saveModManifest(game, mod);

  expect(operationsOf(await deploy())).toEqual([]);
});

test("a deployment after one that couldn't place a file plans that file again", async () => {
  const { game, deployedPath, mod, plan, deploy } = await makeGameWithStagedMod(true);

  await plan();
  game.api.store.dispatch(
    addDeploymentFailures(game.gameId, [
      makeDeploymentFailure({
        source: mod.installationPath,
        relPath: "mod.esp",
        outputPath: deployedPath,
      }),
    ]),
  );
  await game.emitAndAwait("did-deploy", game.profileId, {});

  expect(operationsOf(await deploy())).toEqual([
    { kind: OperationKind.Backup, path: toPortablePath(deployedPath) },
    { kind: OperationKind.Link, path: toPortablePath(deployedPath) },
  ]);
});

test("a deployment plans the mods of the profile it deploys, active or not", async () => {
  const { game, deployedPath, deploy } = await makeGameWithStagedMod(true);
  await deploy();
  const otherProfileId = VortexProfileId("profile-2");
  game.setState((draft) => {
    draft.persistent.profiles[otherProfileId] = makeProfile({
      id: otherProfileId,
      gameId: game.gameId,
      modState: { [MOD_ID]: makeProfileMod({ enabled: false }) },
    });
  });

  expect(operationsOf(await deploy(otherProfileId))).toEqual([
    { kind: OperationKind.Unlink, path: toPortablePath(deployedPath) },
  ]);
});

test("a deployment after a purge plans from the manifests the purge left", async () => {
  const { game, deployedPath, mod, writeDeployed, deploy } = await makeGameWithStagedMod(true);
  await deploy();
  await saveModManifest(game, mod);

  // the purge puts back the file the deployment backed up
  await writeDeployed("original");
  await game.saveManifest([], "hardlink_activator");
  await game.emitAndAwait("did-purge", game.profileId);

  expect(operationsOf(await deploy())).toEqual([
    { kind: OperationKind.Backup, path: toPortablePath(deployedPath) },
    { kind: OperationKind.Link, path: toPortablePath(deployedPath) },
  ]);
});

test("a deployment after a plan that failed plans from the manifests that deployment left", async () => {
  const { game, mod, writeDeployed, hashStagedFile, plan, deploy } =
    await makeGameWithStagedMod(false);
  await deploy();

  setModEnabled(game, MOD_ID, true);
  hashStagedFile.mockRejectedValueOnce(new Error("the staged file is locked"));
  await plan();
  // the deployment goes ahead without its plan
  await writeDeployed("mod");
  await saveModManifest(game, mod);
  await game.emitAndAwait("did-deploy", game.profileId, {});

  expect(operationsOf(await deploy())).toEqual([]);
});

test("a plan run reports its figures for its game, without paths", async () => {
  const { game, deployedPath, deploy } = await makeGameWithStagedMod(true);
  vi.mocked(emitPlannerPlanEvent).mockClear();

  await deploy();

  const [, gameId, figuresOf] = vi.mocked(emitPlannerPlanEvent).mock.calls[0];
  expect(gameId).toBe(game.gameId);
  const figures = figuresOf();
  expect(figures).toMatchObject({
    lockfile_files: 1,
    generated_files: 0,
    disk_entries: 1,
    scan_roots: 1,
    operations: { backup: 1, link: 1, unlink: 0 },
  });
  expect(figures.resolve_ms).toBeDefined();
  const sent = JSON.stringify(figures);
  expect(sent).not.toMatch(/[\\/]/);
  expect(sent).not.toContain(QualifiedPath.fromNative(deployedPath).basename);
});

const shadowComparisons = () => loggedCalls("shadow comparison").map((call) => String(call[2]));

/** The manifest comparison the hook's first report would send. */
const sentManifestDiff = () => vi.mocked(emitPlannerPlanEvent).mock.calls[0][2]().manifest_diff;

test("a plan run finds no mismatch with a deployment that wrote the lockfile's files", async () => {
  const { game, mod, deploy } = await makeGameWithStagedMod(true);
  await saveModManifest(game, mod);
  vi.mocked(emitPlannerPlanEvent).mockClear();

  await deploy();

  expect(sentManifestDiff()).toMatchObject({ verdict: "pass" });
});

test("a plan run logs its mismatches with a deployment as counts, without paths", async () => {
  const { deploy } = await makeGameWithStagedMod(true);
  vi.mocked(emitPlannerPlanEvent).mockClear();
  vi.mocked(window.api).log.mockClear();

  await deploy();

  expect(sentManifestDiff()).toMatchObject({
    verdict: "fail",
    counts: { [ReasonCode.MissingFromDeploy]: 1 },
  });
  expect(shadowComparisons()).toHaveLength(1);
  expect(shadowComparisons()[0]).not.toMatch(/[\\/]/);
});

test("a plan run is kept as its game's last plan, with the destinations that need nothing", async () => {
  const { game, deployedPath, deploy } = await makeGameWithStagedMod(true);
  await deploy();

  // the second run plans against the first run's lockfile, with nothing changed since
  await deploy();

  expect(lastPlanOf(VortexGameId(game.gameId))?.destinations).toMatchObject([
    {
      destinationPath: toPortablePath(deployedPath),
      state: DestinationState.DeployedUnhashed,
      operations: [],
    },
  ]);
});

test("a failed plan run reports the kind of its error", async () => {
  const { game, plan } = await makeGameWithStagedMod(true);
  vi.mocked(emitPlannerPlanEvent).mockClear();
  // the resolver needs the store the game was discovered from
  game.setState((draft) => {
    delete draft.settings.gameMode.discovered[game.gameId].store;
  });

  const planned = await plan();

  expect(planned).toBeUndefined();
  const figures = vi.mocked(emitPlannerPlanEvent).mock.calls[0][2]();
  expect(figures.resolve_ms).toBeUndefined();
  expect(figures.operations).toBeUndefined();
  expect(figures.error_kind).toBeDefined();
});

test("a deployment after one Apply ran plans nothing", async () => {
  const { applyDeploy, deploy } = await makeGameWithStagedMod(true);

  const result = await applyDeploy(await newJournal());

  expect(result?.status).toBe(ApplyStatus.Applied);
  expect(operationsOf(await deploy())).toEqual([]);
});

test("a deployment after one Apply refused plans from the lockfile deployed before it", async () => {
  const { applyDeploy, deploy } = await makeGameWithStagedMod(true);
  await deploy();

  const result = await applyDeploy(await unreadableJournal());
  vi.mocked(window.api).log.mockClear();
  await deploy();

  expect(result?.status).toBe(ApplyStatus.Refused);
  expect(loggedCalls("seeded previous lockfile from manifest")).toHaveLength(0);
});

test("a deployment Apply ran reports its plan run once, with no comparison with the manifests", async () => {
  const { applyDeploy } = await makeGameWithStagedMod(true);
  vi.mocked(emitPlannerPlanEvent).mockClear();

  await applyDeploy(await newJournal());

  expect(emitPlannerPlanEvent).toHaveBeenCalledTimes(1);
  expect(sentManifestDiff()).toBeNull();
});
