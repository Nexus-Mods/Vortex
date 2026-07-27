import * as fs from "fs";
import * as path from "path";

import { unknownToError } from "@vortex/shared";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type {
  IHealthCheckResult,
  IModCheckContext,
  IModHealthCheck,
} from "../../../types/IHealthCheck";
import { HealthCheckSeverity } from "../../../types/IHealthCheck";
import { log } from "../../../util/log";
import { activeGameId } from "../../../util/selectors";
import { installPathForGame } from "../../mod_management/selectors";
import { chunked } from "../utils/shared/batchCache";

/** Map an installed mod's redux state row to an IModCheckContext. */
export interface IInstalledModEntry {
  modId: string;
  stagingPath: string;
  attributes: Record<string, unknown>;
}

/**
 * Enumerate installed mods for the active game by reading Redux state.
 *
 * Returns the staging-path + attributes for each mod in persistent state.
 * Pure relative to the API: callers can mock `api.getState()` and the staging
 * dir lookup. Filesystem walks happen in `buildModCheckContext`, not here.
 */
export function enumerateInstalledMods(api: IExtensionApi): IInstalledModEntry[] {
  const state = api.getState();
  const gameId = activeGameId(state);
  if (!gameId) {
    return [];
  }
  const modsById = state.persistent.mods[gameId] ?? {};
  const stagingRoot = installPathForGame(state, gameId);
  if (!stagingRoot) {
    return [];
  }
  return Object.entries(modsById).map(([modId, mod]) => ({
    modId,
    stagingPath: path.join(stagingRoot, mod.installationPath ?? modId),
    attributes: mod.attributes ?? {},
  }));
}

/**
 * Build an IModCheckContext for one installed mod by walking its staging dir.
 */
export async function buildModCheckContext(entry: IInstalledModEntry): Promise<IModCheckContext> {
  const files = await walkRelative(entry.stagingPath);
  return {
    modId: entry.modId,
    files,
    readFile: (rel) => fs.promises.readFile(path.join(entry.stagingPath, rel)),
    attributes: entry.attributes,
  };
}

async function walkRelative(root: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: string, rel: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const childAbs = path.join(dir, e.name);
      const childRel = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        await rec(childAbs, childRel);
      } else {
        out.push(childRel);
      }
    }
  }
  // Only swallow "root doesn't exist" — mid-walk errors propagate.
  try {
    await fs.promises.access(root);
  } catch {
    log("warn", "mod staging dir not found", { root });
    return out;
  }
  await rec(root, "");
  return out;
}

/**
 * How many mods are walked at a time. Each in-flight mod holds its whole file list in memory for
 * as long as `checkMod` runs. The walk is filesystem-bound, so wider waves buy no measurable
 * speedup.
 */
export const MOD_WALK_CONCURRENCY = 16;

/** How many failing mod ids the summary log names before it stops listing them. */
const LOGGED_MOD_SAMPLE = 10;

/**
 * Run a per-mod healthcheck across all installed mods for the active game and
 * fold the per-mod results into a single IHealthCheckResult (worst severity
 * wins; per-mod messages are concatenated into `details`).
 *
 * On `signal`, the walk stops at the next wave boundary and aggregates what it has.
 * `enumerate` / `buildContext` are a seam for unit tests; production callers pass neither.
 */
export interface IPerModCheckOpts {
  signal?: AbortSignal;
  enumerate?: typeof enumerateInstalledMods;
  buildContext?: typeof buildModCheckContext;
}

export async function runPerModCheck(
  hc: IModHealthCheck,
  api: IExtensionApi,
  opts: IPerModCheckOpts = {},
): Promise<IHealthCheckResult> {
  const enumerate = opts.enumerate ?? enumerateInstalledMods;
  const buildContext = opts.buildContext ?? buildModCheckContext;
  const signal = opts.signal;
  const startedAt = Date.now();
  const mods = enumerate(api);
  if (mods.length === 0) {
    return {
      checkId: hc.id,
      status: "passed",
      severity: HealthCheckSeverity.Info,
      message: "No mods installed; nothing to check.",
      executionTime: Date.now() - startedAt,
      timestamp: new Date(),
    };
  }

  const errorFor = (modId: string, prefix: string, err: unknown): IHealthCheckResult => {
    const error = unknownToError(err);
    return {
      checkId: hc.id,
      status: "error",
      severity: HealthCheckSeverity.Error,
      message: `${prefix} ${modId}: ${error.message || "unknown error"}`,
      details: error.stack,
      executionTime: 0,
      timestamp: new Date(),
    };
  };

  const checkOne = async (entry: IInstalledModEntry): Promise<IHealthCheckResult> => {
    // A throw from buildContext is a fault in this module or the staging folder, not in the
    // extension's check; the rejected branch below attributes it to this mod.
    const ctx = await buildContext(entry);
    try {
      return await hc.checkMod(api, ctx, signal);
    } catch (err: unknown) {
      return errorFor(entry.modId, "checkMod threw for", err);
    }
  };

  const perMod: IHealthCheckResult[] = [];
  const unreadable: string[] = [];
  let abandoned = false;

  for (const wave of chunked(mods, MOD_WALK_CONCURRENCY)) {
    if (signal?.aborted) {
      abandoned = true;
      break;
    }
    // An unreadable staging folder (scanner lock, mod removed mid-walk) fails that mod alone.
    const waveResults = await Promise.allSettled(wave.map(checkOne));
    for (let i = 0; i < waveResults.length; i += 1) {
      const settled = waveResults[i];
      if (settled.status === "fulfilled") {
        perMod.push(settled.value);
        continue;
      }
      const modId = wave[i].modId;
      unreadable.push(modId);
      perMod.push(errorFor(modId, "Could not read staging folder for", settled.reason));
    }
  }

  // One line per run, not per mod: a staging drive that has gone away would flood the log. Each
  // failure is spelled out in the aggregate's `details`.
  if (unreadable.length > 0) {
    log("error", "per-mod check could not read some mods", {
      id: hc.id,
      count: unreadable.length,
      mods: unreadable.slice(0, LOGGED_MOD_SAMPLE),
    });
  }

  const result = aggregateResults(hc.id, perMod, startedAt);
  if (abandoned) {
    log("debug", "per-mod check abandoned mid-walk", {
      id: hc.id,
      checked: perMod.length,
      total: mods.length,
    });
    // A partial walk is not a clean bill of health for the library.
    result.message = `${result.message} (stopped after ${perMod.length} of ${mods.length} mods)`;
  }
  return result;
}

export function aggregateResults(
  checkId: string,
  results: IHealthCheckResult[],
  startedAt: number,
): IHealthCheckResult {
  const order: HealthCheckSeverity[] = [
    HealthCheckSeverity.Info,
    HealthCheckSeverity.Warning,
    HealthCheckSeverity.Error,
    HealthCheckSeverity.Critical,
  ];
  let worst = HealthCheckSeverity.Info;
  for (const r of results) {
    if (order.indexOf(r.severity) > order.indexOf(worst)) {
      worst = r.severity;
    }
  }
  const failed = results.filter((r) => r.status === "failed" || r.status === "error");
  const warning = results.filter((r) => r.status === "warning");
  let status: IHealthCheckResult["status"] = "passed";
  if (failed.length > 0) status = "failed";
  else if (warning.length > 0) status = "warning";

  return {
    checkId,
    status,
    severity: worst,
    message:
      status === "passed"
        ? `${results.length} mods checked, all clean`
        : `${failed.length} failed / ${warning.length} warned of ${results.length} mods`,
    details: results
      .filter((r) => r.status !== "passed")
      .map((r) => `[${r.severity}] ${r.message}`)
      .join("\n"),
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}
