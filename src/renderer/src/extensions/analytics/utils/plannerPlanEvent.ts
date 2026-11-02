import type { PlannerPlanPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { FlagService } from "../../../FlagService";
import { log } from "../../../logging";
import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/** The figures one plan run measured; the payload sends any it did not as null. */
export type PlannerPlanFigures = Partial<Omit<PlannerPlanPayload, "game_id">>;

/** The planner_plan payload for a game's plan run. */
export function plannerPlanPayload(
  nexusGameId: string,
  figures: PlannerPlanFigures,
): PlannerPlanPayload {
  return {
    game_id: nexusGameId,
    mods: null,
    lockfile_files: null,
    generated_files: null,
    disk_entries: null,
    scan_roots: null,
    first_run: null,
    resolve_ms: null,
    scan_ms: null,
    plan_ms: null,
    operations: null,
    case_mismatches: null,
    manifest_diff: null,
    error_kind: null,
    ...figures,
  };
}

// the games each session has reported a plan run for; one api serves one session
const reportedGames = new WeakMap<IExtensionApi, Set<string>>();

/**
 * Submits the planner_plan telemetry event for a game's first plan run of the session. A no-op
 * unless the user consented to analytics and is logged in, the game is a Nexus game and the
 * planner telemetry flag is on; `figuresOf` runs only for a run that is sent. Fire and forget:
 * failures and rejections are logged, never thrown, so the plan this reports never depends on
 * telemetry.
 */
export async function emitPlannerPlanEvent(
  api: IExtensionApi,
  internalGameId: string,
  figuresOf: () => PlannerPlanFigures,
): Promise<void> {
  const state = api.getState();
  if (!isTelemetryEnabled(state) || !isLoggedIn(state)) {
    return;
  }

  const nexusGameId = numericNexusGameId(internalGameId);
  const reported = reportedGames.get(api) ?? new Set<string>();
  // the flag comes last: each read reports an evaluation
  if (
    nexusGameId === null ||
    reported.has(internalGameId) ||
    FlagService.instance?.getFlag("vortex-planner-telemetry") === undefined
  ) {
    return;
  }
  reportedGames.set(api, reported.add(internalGameId));

  try {
    const res = await createVortexNexusV3InternalClient(api).telemetryEvent(
      crypto.randomUUID(),
      Temporal.Now.instant(),
      {
        type: "planner_plan",
        version: 1,
        payload: plannerPlanPayload(String(nexusGameId), figuresOf()),
      },
    );
    if (res.rejected.length > 0) {
      log("warn", "planner-plan: telemetry event rejected", { rejected: res.rejected });
    }
  } catch (err) {
    log("warn", "planner-plan: telemetry submit failed", {
      error: getErrorMessageOrDefault(err),
    });
  }
}
