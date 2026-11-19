import * as path from "node:path";

import {
  getErrorMessageOrDefault,
  VortexDeploymentMethodId,
  VortexError,
  type VortexErrorKind,
  type VortexGameId,
  type VortexModTypeId,
  type VortexProfileId,
} from "@vortex/shared";

import { FlagService } from "../../../FlagService";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import getVortexPath from "../../../util/getVortexPath";
import type { IMergeResultByType } from "../modMerging";
import { installPathForGame } from "../selectors";
import { recordDeploymentSavingManifests } from "./appliedManifests";
import {
  ApplyStatus,
  destinationOf,
  RefusalReason,
  resumeApply,
  type AppliedResult,
  type ApplyResult,
  type FailedStep,
  type NothingToDoResult,
  type RefusedResult,
  type ResumeResult,
  type RolledBackResult,
  type RunOptions,
} from "./apply/apply";
import type { JournalPhase, JournalStorage } from "./apply/journal";
import { DEPLOYMENT_FOLDER_TAG, type DeploymentPlan } from "./deploymentPlan";
import { isGameWithPlannedDeployments, type DeployOrchestrator } from "./DeployOrchestrator";
import { journalStorageAt } from "./journalStorage";
import { toPortablePath, type ManifestFiles } from "./resolverInput";

/** The deployment method Apply deploys with. */
const APPLY_DEPLOYMENT_METHOD = VortexDeploymentMethodId("hardlink_activator");

/** How a deployment is planned. */
export const DeploymentPlanning = {
  /** planned, and the plan runs through Apply */
  ThroughApply: "through-apply",
  /** planned beside today's deployment, which changes the disk */
  BesideTodaysDeployment: "beside-todays-deployment",
  /** not planned; today's deployment changes the disk */
  Unplanned: "unplanned",
} as const;
export type DeploymentPlanning = (typeof DeploymentPlanning)[keyof typeof DeploymentPlanning];

/**
 * How a deployment of the game by this deployment method is planned. With the mod pipeline flag
 * on, a planned game deploys through Apply by hardlink. Planning hashes every staged file, so
 * other deployments of a planned game are planned only in dev builds or with the flag.
 */
export function deploymentPlanningFor(
  gameMode: VortexGameId,
  deploymentMethodId: VortexDeploymentMethodId,
): DeploymentPlanning {
  if (!isGameWithPlannedDeployments(gameMode)) {
    return DeploymentPlanning.Unplanned;
  }
  // each flag read reports an evaluation
  const isModPipelineFlagOn = FlagService.instance?.getFlag("vortex-mod-pipeline") !== undefined;
  if (isModPipelineFlagOn && deploymentMethodId === APPLY_DEPLOYMENT_METHOD) {
    return DeploymentPlanning.ThroughApply;
  }
  return isModPipelineFlagOn || process.env.NODE_ENV === "development"
    ? DeploymentPlanning.BesideTodaysDeployment
    : DeploymentPlanning.Unplanned;
}

/** Where the journal of a game's Apply runs is kept, one per game. */
export const applyJournalFileFor = (gameMode: VortexGameId) =>
  path.join(getVortexPath("userData"), gameMode, "apply", "journal.ndjson");

/** Where a game's Apply runs keep the files they set aside, next to the staging folder. */
export const keptFolderFor = (stagingPath: string, gameMode: VortexGameId) =>
  path.join(path.dirname(stagingPath), "vortex-apply-kept", gameMode);

/** Where an Apply run keeps its journal and set-aside files, and who hears its progress. */
export interface ApplyRunOptions {
  journal: JournalStorage;
  /** where `journal` keeps the journal, for the failure messages */
  journalFile: string;
  keptFolder: string;
  onProgress?: RunOptions["onProgress"];
}

export interface PlanAndApplyDeploymentOptions extends ApplyRunOptions {
  profileId: VortexProfileId;
  /** by mod type */
  mergeResult: Record<VortexModTypeId, IMergeResultByType>;
}

/** The run options default to the game's journal and kept folder. */
export interface PlanAndApplyPurgeOptions extends Partial<ApplyRunOptions> {
  gameMode: VortexGameId;
}

/**
 * An Apply progress callback that moves a progress bar from `from` to `to` percent, labelled by the
 * run's phase, reporting only when the whole percent or the phase changes.
 */
export function progressBarFor(
  report: (label: string, percent: number) => void,
  labelOfPhase: Record<JournalPhase, string>,
  from: number,
  to: number,
): NonNullable<RunOptions["onProgress"]> {
  let lastReported: { phase: JournalPhase; percent: number } | undefined;
  return (done, total, phase) => {
    const percent = Math.floor(from + ((to - from) * done) / total);
    if (lastReported?.phase === phase && lastReported.percent === percent) {
      return;
    }
    lastReported = { phase, percent };
    report(labelOfPhase[phase], percent);
  };
}

/** What an Apply run does. */
export const ApplyRunKind = { Deployment: "deployment", Purge: "purge" } as const;
export type ApplyRunKind = (typeof ApplyRunKind)[keyof typeof ApplyRunKind];

/** How the failure messages name each kind of run. */
const wordingOfRunKind: Record<ApplyRunKind, { noun: string; verb: string }> = {
  [ApplyRunKind.Deployment]: { noun: "deployment", verb: "deploy" },
  [ApplyRunKind.Purge]: { noun: "purge", verb: "purge" },
};

/** The error kinds of a failed Apply run; not bugs to report. */
export const APPLY_RUN_FAILURE_KINDS: ReadonlySet<VortexErrorKind> = new Set<VortexErrorKind>([
  "deployment:interrupted-run-unsettled",
  "deployment:apply-failed",
]);

/** The error a run through Apply fails with; not a bug to report. */
const applyFailedError = (
  runKind: ApplyRunKind,
  message: string,
  applyStatus?: Exclude<ApplyResult, AppliedResult>["status"],
) =>
  new VortexError(message, {
    kind: "deployment:apply-failed",
    runKind,
    ...(applyStatus === undefined ? {} : { applyStatus }),
  });

function failedStepDescriptionOf({ index, operation, cause }: FailedStep): string {
  const parts: string[] = [];
  if (index !== undefined) {
    parts.push(`step ${index + 1}`);
  }
  if (operation !== undefined) {
    parts.push(`${operation.kind} ${destinationOf(operation)}`);
  }
  parts.push(getErrorMessageOrDefault(cause));
  return parts.join(", ");
}

/** Why Apply refused a run, as a clause. */
function refusalCauseOf({ reason, path: refusedPath, cause }: RefusedResult, journalFile: string) {
  switch (reason) {
    case RefusalReason.JournalExists:
      return `an earlier deployment left its journal at ${journalFile}`;
    case RefusalReason.JournalUnavailable:
      return `the journal at ${journalFile} can't be used${cause === undefined ? "" : `: ${getErrorMessageOrDefault(cause)}`}`;
    case RefusalReason.GeneratedFile:
      return `the plan changes ${refusedPath}, a file Vortex generates`;
    case RefusalReason.NoStagedFile:
      return `the staged file for ${refusedPath} is missing`;
    case RefusalReason.InvalidPath:
      return `the plan holds a path it can't use: ${refusedPath}`;
    default: {
      const exhausted: never = reason;
      return exhausted;
    }
  }
}

/** Why a run that didn't apply failed, for the run's error. */
function failureMessageOf(
  result: Exclude<ApplyResult, AppliedResult>,
  journalFile: string,
  runKind: ApplyRunKind,
) {
  const { noun, verb } = wordingOfRunKind[runKind];
  switch (result.status) {
    case ApplyStatus.Refused:
      return `Vortex didn't ${verb}, because ${refusalCauseOf(result, journalFile)}`;
    case ApplyStatus.RolledBack:
      return result.failedAt === undefined
        ? `The ${noun} was undone`
        : `The ${noun} failed at ${failedStepDescriptionOf(result.failedAt)}, and was undone`;
    case ApplyStatus.RollbackFailed:
      return `The ${noun} failed, and undoing it stopped at ${failedStepDescriptionOf(result.rollbackFailedAt)}; the journal at ${journalFile} records what changed`;
    case ApplyStatus.Unfinished:
      return `The ${noun} changed every file but couldn't finish: ${getErrorMessageOrDefault(result.cause)}; the journal at ${journalFile} records what changed`;
    default: {
      const exhausted: never = result;
      return exhausted;
    }
  }
}

/**
 * Plans a profile's deployment and runs the plan through Apply, giving the manifest entries it
 * saved. Fails, naming the cause, when the deployment holds merged files, can't be planned, or
 * doesn't apply.
 */
export async function planAndApplyDeployment(
  api: IExtensionApi,
  orchestrator: DeployOrchestrator,
  { profileId, mergeResult, ...run }: PlanAndApplyDeploymentOptions,
): Promise<ManifestFiles> {
  // the lockfile has no merged files
  const hasMergedFiles = Object.values(mergeResult).some(
    ({ usedInMerge, mergeInfluences }) =>
      usedInMerge.length > 0 || Object.keys(mergeInfluences).length > 0,
  );
  if (hasMergedFiles) {
    // TODO: remove this once we figure out how to deal with merged files.
    throw applyFailedError(
      ApplyRunKind.Deployment,
      "A deployment through Apply can't deploy merged files",
    );
  }
  const plan = await orchestrator.plan(profileId);
  if (plan === undefined) {
    throw applyFailedError(
      ApplyRunKind.Deployment,
      "The deployment couldn't be planned; see the log",
    );
  }
  return applyPlanned(api, orchestrator, plan, ApplyRunKind.Deployment, run);
}

/**
 * Plans a purge of the game's deployment and runs it through Apply. Fails, naming the cause, when it
 * can't be planned or doesn't apply.
 */
export async function planAndApplyPurge(
  api: IExtensionApi,
  orchestrator: DeployOrchestrator,
  {
    gameMode,
    journalFile = applyJournalFileFor(gameMode),
    journal = journalStorageAt(journalFile),
    keptFolder = keptFolderFor(installPathForGame(api.getState(), gameMode), gameMode),
    onProgress,
  }: PlanAndApplyPurgeOptions,
): Promise<void> {
  const plan = await orchestrator.planPurge(gameMode);
  if (plan === undefined) {
    throw applyFailedError(ApplyRunKind.Purge, "The purge couldn't be planned; see the log");
  }
  await applyPlanned(api, orchestrator, plan, ApplyRunKind.Purge, {
    journal,
    journalFile,
    keptFolder,
    onProgress,
  });
}

/** Runs the plan the orchestrator holds through Apply, giving the manifest entries it saved. */
async function applyPlanned(
  api: IExtensionApi,
  orchestrator: DeployOrchestrator,
  plan: DeploymentPlan,
  runKind: ApplyRunKind,
  { journal, journalFile, keptFolder, onProgress }: ApplyRunOptions,
): Promise<ManifestFiles> {
  const applied = await orchestrator.apply(
    plan,
    {
      fs: window.api.fs,
      journal,
      keptPathOf: (_destinationPath, runId, entryIndex) =>
        toPortablePath(path.join(keptFolder, runId, String(entryIndex))),
      onProgress,
    },
    APPLY_DEPLOYMENT_METHOD,
  );
  if (applied === undefined) {
    throw applyFailedError(
      runKind,
      `The ${wordingOfRunKind[runKind].noun}'s plan was replaced before it ran`,
    );
  }
  const { result, savedManifestFiles } = applied;
  if (result.status !== ApplyStatus.Applied) {
    throw applyFailedError(runKind, failureMessageOf(result, journalFile, runKind), result.status);
  }
  notifyFilesSetAside(api, result, keptFolder);
  return savedManifestFiles ?? new Map();
}

function notifyFilesSetAside(api: IExtensionApi, { kept }: AppliedResult, keptFolder: string) {
  if (kept.length > 0) {
    api.sendNotification?.({
      type: "warning",
      title: "Files set aside",
      message: `${kept.length} files Vortex didn't deploy were moved to ${keptFolder}`,
    });
  }
}

/** Why the run a killed deployment left can't be settled, as a clause. */
function settleFailureCauseOf(
  result: Exclude<ResumeResult, AppliedResult | RolledBackResult | NothingToDoResult>,
  journalFile: string,
) {
  switch (result.status) {
    case ApplyStatus.Refused:
      return refusalCauseOf(result, journalFile);
    case ApplyStatus.RollbackFailed:
      return `undoing the run in the journal at ${journalFile} stopped at ${failedStepDescriptionOf(result.rollbackFailedAt)}`;
    case ApplyStatus.Unfinished:
      return `finishing the run in the journal at ${journalFile} failed: ${getErrorMessageOrDefault(result.cause)}`;
    default: {
      const exhausted: never = result;
      return exhausted;
    }
  }
}

export interface SettleLeftoverDeploymentOptions {
  /** the game's journal file by default */
  journalFile?: string;
  /** the storage at `journalFile` by default */
  journal?: JournalStorage;
  onProgress?: RunOptions["onProgress"];
}

/**
 * Finishes the run a killed deployment of the game left in its journal, or undoes it when it can't
 * be finished; called with the activation lock held. Fails, naming the journal, while it can't.
 */
export async function settleLeftoverDeployment(
  api: IExtensionApi,
  gameMode: VortexGameId,
  {
    journalFile = applyJournalFileFor(gameMode),
    journal = journalStorageAt(journalFile),
    onProgress,
  }: SettleLeftoverDeploymentOptions = {},
): Promise<void> {
  if (!isGameWithPlannedDeployments(gameMode)) {
    return;
  }
  const fs = window.api.fs;
  const result = await resumeApply({
    fs,
    journal,
    recordDeployment: recordDeploymentSavingManifests(api, gameMode, fs),
    folderTag: DEPLOYMENT_FOLDER_TAG,
    onProgress,
  });
  switch (result.status) {
    case ApplyStatus.NothingToDo:
      return;
    case ApplyStatus.Applied:
      api.sendNotification?.({ type: "info", message: "Interrupted deployment finished" });
      notifyFilesSetAside(
        api,
        result,
        keptFolderFor(installPathForGame(api.getState(), gameMode), gameMode),
      );
      return;
    case ApplyStatus.RolledBack:
      api.sendNotification?.({ type: "info", message: "Interrupted deployment undone" });
      return;
    default:
      throw new VortexError(
        `Vortex can't settle an interrupted deployment, because ` +
          `${settleFailureCauseOf(result, journalFile)}, so it won't deploy or purge this game`,
        { kind: "deployment:interrupted-run-unsettled", journalFile },
      );
  }
}
