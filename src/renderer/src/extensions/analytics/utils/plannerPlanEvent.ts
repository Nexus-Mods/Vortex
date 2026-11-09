import type { EventPlannerPlan, PlannerPlanPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault, type GameId, type VortexGameId } from "@vortex/shared";

import { FlagService } from "../../../FlagService";
import { log } from "../../../logging";
import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/** The figures a plan run measured. */
export type PlannerPlanFigures = Partial<Omit<PlannerPlanPayload, "game_id">>;

/** The planner_plan payload for a plan run; figures it did not measure are null. */
export function plannerPlanPayload(
  nexusGameId: GameId,
  figures: PlannerPlanFigures,
): PlannerPlanPayload {
  return {
    game_id: String(nexusGameId),
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

/**
 * Whether planner telemetry can be sent: consent, a login and the planner telemetry flag on. The
 * flag is read only with consent and a login, since each read reports an evaluation.
 */
export function isPlannerTelemetryOn(state: IState): boolean {
  return (
    isTelemetryEnabled(state) &&
    isLoggedIn(state) &&
    FlagService.instance?.getFlag("vortex-planner-telemetry") !== undefined
  );
}

// the games reported per session; one api serves one session
const reportedGames = new WeakMap<IExtensionApi, Set<VortexGameId>>();

/**
 * Sends a game's first plan run of the session, with consent, a login, a Nexus game id and the
 * planner telemetry flag on; a dev build logs the event it does not send. `figuresOf` runs only
 * for an event that is sent or logged. Failures are logged, never thrown.
 */
export async function emitPlannerPlanEvent(
  api: IExtensionApi,
  internalGameId: VortexGameId,
  figuresOf: () => PlannerPlanFigures,
): Promise<void> {
  try {
    const state = api.getState();
    const devBuild = process.env.NODE_ENV === "development";
    const consented = isTelemetryEnabled(state) && isLoggedIn(state);
    const reported = reportedGames.get(api) ?? new Set<VortexGameId>();
    if ((!consented && !devBuild) || reported.has(internalGameId)) {
      return;
    }
    const nexusGameId = numericNexusGameId(internalGameId);
    if (nexusGameId === null) {
      return;
    }
    const sends = consented && isPlannerTelemetryOn(state);
    if (!sends && !devBuild) {
      return;
    }
    reportedGames.set(api, reported.add(internalGameId));

    const event: EventPlannerPlan = {
      type: "planner_plan",
      version: 1,
      payload: plannerPlanPayload(nexusGameId, figuresOf()),
    };
    if (!sends) {
      log("info", "planner-plan: telemetry event not sent in a dev build", event);
      return;
    }
    const res = await createVortexNexusV3InternalClient(api).telemetryEvent(
      crypto.randomUUID(),
      Temporal.Now.instant(),
      event,
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
