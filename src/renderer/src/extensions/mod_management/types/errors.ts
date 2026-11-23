import type { AppliedResult, ApplyResult } from "../util/apply/apply";
import type { ApplyRunKind } from "../util/applyDeploy";

/** Every error kind mod management raises, merged into the shared catalog. */
declare module "@vortex/shared/errors" {
  interface VortexErrorKindMap {
    /**
     * The run a killed deployment left in the journal at `journalFile` can't be settled, so the
     * game's deployments and purges wait for it.
     */
    "deployment:interrupted-run-unsettled": { journalFile: string };
    /** A run through Apply failed; `applyStatus` is how Apply ended. */
    "deployment:apply-failed": {
      runKind: ApplyRunKind;
      applyStatus?: Exclude<ApplyResult, AppliedResult>["status"];
    };
  }
}
