import * as path from "node:path";

import type { Operation } from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault, VortexProfileId } from "@vortex/shared";
import { ChaosFS, QualifiedPath, type FileSystem } from "@vortex/shared/filesystem";

import { ApplyStatus, type ApplyResult, type FailedStep } from "./apply/apply";
import { operationsInApplyOrder, type DeploymentPlan } from "./deploymentPlan";
import type { DeployOrchestrator } from "./DeployOrchestrator";
import { journalStorageAt } from "./journalStorage";
import { toPortablePath } from "./resolverInput";

/** An operation of a plan, as a tool sees it. */
interface DevOperation {
  kind: Operation["kind"];
  destinationPath: string;
}

/** A disk call an Apply run is made to fail every time, as a file in use. */
interface DevFault {
  call: "createLink" | "delete" | "move";
  /** absolute and native; the call fails when one of its paths is this one */
  path: string;
}

interface DevApplyRequest {
  profileId: string;
  /** absolute and native */
  journalFile: string;
  /** absolute and native, on the game's drive */
  keptFolder: string;
  fault?: DevFault;
}

/** A step that failed, as a tool sees it. */
interface DevFailedStep {
  index?: number;
  operation?: DevOperation;
  error: string;
}

interface DevApplyOutcome {
  operations: DevOperation[];
  status: ApplyResult["status"];
  refusal?: string;
  refusedPath?: string;
  failedAt?: DevFailedStep;
  rollbackFailedAt?: DevFailedStep;
  keptPaths: string[];
}

/** What a dev build exposes on `window` for tools on the debug port. */
interface ApplyDevHandle {
  /** Plans a profile's deployment; undefined when it can't be planned. */
  plan: (profileId: string) => Promise<DevOperation[] | undefined>;
  /** Plans a profile's deployment and runs the plan through Apply on the real disk. */
  apply: (request: DevApplyRequest) => Promise<DevApplyOutcome | undefined>;
}

declare global {
  interface Window {
    __vortexApplyDevHandle?: ApplyDevHandle;
  }
}

const devOperationOf = (operation: Operation): DevOperation => ({
  kind: operation.kind,
  destinationPath: "file" in operation ? operation.file.destinationPath : operation.destinationPath,
});

const devOperationsOf = (plan: DeploymentPlan) =>
  operationsInApplyOrder(plan.destinations).map(devOperationOf);

const devFailedStepOf = ({ index, operation, cause }: FailedStep): DevFailedStep => ({
  index,
  operation: operation === undefined ? undefined : devOperationOf(operation),
  error: getErrorMessageOrDefault(cause),
});

/** The disk, failing every call the fault names: Apply tries a failed link a second time. */
function diskWith(fault: DevFault | undefined): FileSystem {
  if (fault === undefined) {
    return window.api.fs;
  }
  const faultPath = QualifiedPath.fromNative(fault.path);
  return new ChaosFS(window.api.fs, [
    {
      fault: { kind: "os:generic", originalCode: "EBUSY" },
      op: fault.call,
      path: (calledPath) => QualifiedPath.equals(calledPath, faultPath),
      times: Infinity,
    },
  ]);
}

function devOutcomeOf(operations: DevOperation[], result: ApplyResult): DevApplyOutcome {
  const outcome: DevApplyOutcome = { operations, status: result.status, keptPaths: [] };
  switch (result.status) {
    case ApplyStatus.Applied:
      return { ...outcome, keptPaths: result.kept.map(({ keptPath }) => keptPath) };
    case ApplyStatus.Refused:
      return { ...outcome, refusal: result.reason, refusedPath: result.path };
    case ApplyStatus.RolledBack:
      return {
        ...outcome,
        failedAt: result.failedAt === undefined ? undefined : devFailedStepOf(result.failedAt),
      };
    case ApplyStatus.RollbackFailed:
      return {
        ...outcome,
        rollbackFailedAt: devFailedStepOf(result.rollbackFailedAt),
        failedAt: result.failedAt === undefined ? undefined : devFailedStepOf(result.failedAt),
      };
    case ApplyStatus.Unfinished:
      return { ...outcome, failedAt: { error: getErrorMessageOrDefault(result.cause) } };
    default: {
      const exhausted: never = result;
      return exhausted;
    }
  }
}

/**
 * Lets a tool on the debug port run a profile's plan through Apply, outside a deployment: no
 * activation lock, no manifests, no deployment events. Dev builds only.
 */
export function exposeApplyDevHandle(orchestrator: DeployOrchestrator): void {
  window.__vortexApplyDevHandle = {
    plan: async (profileId) => {
      const plan = await orchestrator.plan(VortexProfileId(profileId));
      return plan === undefined ? undefined : devOperationsOf(plan);
    },
    apply: async ({ profileId, journalFile, keptFolder, fault }) => {
      const plan = await orchestrator.plan(VortexProfileId(profileId));
      if (plan === undefined) {
        return undefined;
      }
      const result = await orchestrator.apply(plan, {
        fs: diskWith(fault),
        journal: journalStorageAt(journalFile),
        keptPathOf: (_destinationPath, runId, entryIndex) =>
          toPortablePath(path.join(keptFolder, runId, String(entryIndex))),
      });
      return result === undefined ? undefined : devOutcomeOf(devOperationsOf(plan), result);
    },
  };
}
