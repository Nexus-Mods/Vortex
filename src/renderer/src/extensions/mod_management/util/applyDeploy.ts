import * as path from "node:path";

import {
  getErrorMessageOrDefault,
  VortexDeploymentMethodId,
  type VortexGameId,
  type VortexModTypeId,
  type VortexProfileId,
} from "@vortex/shared";

import { FlagService } from "../../../FlagService";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import getVortexPath from "../../../util/getVortexPath";
import type { IMergeResultByType } from "../modMerging";
import {
  ApplyStatus,
  destinationOf,
  RefusalReason,
  type AppliedResult,
  type ApplyResult,
  type FailedStep,
  type RefusedResult,
} from "./apply/apply";
import type { JournalStorage } from "./apply/journal";
import { isGameWithPlannedDeployments, type DeployOrchestrator } from "./DeployOrchestrator";
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

export interface PlanAndApplyDeploymentOptions {
  profileId: VortexProfileId;
  /** by mod type */
  mergeResult: Record<VortexModTypeId, IMergeResultByType>;
  journal: JournalStorage;
  /** where `journal` keeps the journal, for the failure messages */
  journalFile: string;
  keptFolder: string;
}

/** An error the deployment fails with, naming the cause, not a bug to report. */
const deploymentError = (message: string) =>
  Object.assign(new Error(message), { allowReport: false });

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

function refusalMessageOf(
  { reason, path: refusedPath, cause }: RefusedResult,
  journalFile: string,
) {
  switch (reason) {
    case RefusalReason.JournalExists:
      return `Vortex didn't deploy, because an earlier deployment left its journal at ${journalFile}`;
    case RefusalReason.JournalUnavailable:
      return `Vortex didn't deploy, because it couldn't use the journal at ${journalFile}${cause === undefined ? "" : `: ${getErrorMessageOrDefault(cause)}`}`;
    case RefusalReason.GeneratedFile:
      return `Vortex didn't deploy, because the plan changes ${refusedPath}, a file Vortex generates`;
    case RefusalReason.NoStagedFile:
      return `Vortex didn't deploy, because the staged file for ${refusedPath} is missing`;
    case RefusalReason.InvalidPath:
      return `Vortex didn't deploy, because the plan holds a path it can't use: ${refusedPath}`;
    default: {
      const exhausted: never = reason;
      return exhausted;
    }
  }
}

/** Why a run that didn't apply failed, for the deployment's error. */
function failureMessageOf(result: Exclude<ApplyResult, AppliedResult>, journalFile: string) {
  switch (result.status) {
    case ApplyStatus.Refused:
      return refusalMessageOf(result, journalFile);
    case ApplyStatus.RolledBack:
      return result.failedAt === undefined
        ? "The deployment was undone"
        : `The deployment failed at ${failedStepDescriptionOf(result.failedAt)}, and was undone`;
    case ApplyStatus.RollbackFailed:
      return `The deployment failed, and undoing it stopped at ${failedStepDescriptionOf(result.rollbackFailedAt)}; the journal at ${journalFile} records what changed`;
    case ApplyStatus.Unfinished:
      return `The deployment changed every file but couldn't finish: ${getErrorMessageOrDefault(result.cause)}; the journal at ${journalFile} records what changed`;
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
  { profileId, mergeResult, journal, journalFile, keptFolder }: PlanAndApplyDeploymentOptions,
): Promise<ManifestFiles> {
  // the lockfile has no merged files
  const hasMergedFiles = Object.values(mergeResult).some(
    ({ usedInMerge, mergeInfluences }) =>
      usedInMerge.length > 0 || Object.keys(mergeInfluences).length > 0,
  );
  if (hasMergedFiles) {
    // TODO: remove this once we figure out how to deal with merged files.
    throw deploymentError("A deployment through Apply can't deploy merged files");
  }
  const plan = await orchestrator.plan(profileId);
  if (plan === undefined) {
    throw deploymentError("The deployment couldn't be planned; see the log");
  }
  const applied = await orchestrator.apply(
    plan,
    {
      fs: window.api.fs,
      journal,
      keptPathOf: (_destinationPath, runId, entryIndex) =>
        toPortablePath(path.join(keptFolder, runId, String(entryIndex))),
    },
    APPLY_DEPLOYMENT_METHOD,
  );
  if (applied === undefined) {
    throw deploymentError("The deployment's plan was replaced before it ran");
  }
  const { result, savedManifestFiles } = applied;
  if (result.status !== ApplyStatus.Applied) {
    throw deploymentError(failureMessageOf(result, journalFile));
  }
  if (result.kept.length > 0) {
    api.sendNotification?.({
      type: "warning",
      title: "Files set aside",
      message: `${result.kept.length} files Vortex didn't deploy were moved to ${keptFolder}`,
    });
  }
  return savedManifestFiles ?? new Map();
}
