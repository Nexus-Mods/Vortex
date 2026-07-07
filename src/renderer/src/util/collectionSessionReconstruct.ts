/**
 * Reconstructing the collection install session from reality (the read side derives status
 * per row; this builds/realigns the whole session). Lives in core alongside the rest of the
 * session utilities (collectionInstallSession, collectionInstallSessionSelectors,
 * collectionSessionWrite) rather than inside the collections extension, so any caller can
 * rebuild or resync a session without depending on the driver instance.
 */
import * as installActions from "../actions/collectionInstallTracking";
import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IMod, IModRule } from "../extensions/mod_management/types/IMod";
import { findDownloadByRef } from "../extensions/mod_management/util/dependencies";
import { findModByRef } from "../extensions/mod_management/util/findModByRef";
import { rulePhase } from "../extensions/mod_management/util/rulePhase";
import {
  isDependencyRule,
  ruleInstallSpec,
} from "../extensions/mod_management/util/testModReference";
import { log } from "../logging";
import type { ICollectionModInstallInfo } from "../types/collections/ICollectionInstallSession";
import type { IExtensionApi } from "../types/IExtensionContext";
import { modRuleId, reconstructModStatus } from "./collectionInstallSession";
import { getCollectionActiveSession } from "./collectionInstallSessionSelectors";
import { batchDispatch } from "./util";

/**
 * Build the session's per-rule install info from reality: for every required/recommended
 * rule, resolve the installed mod (matched by reference AND install spec, the same match
 * the dependency loop uses) and the rule's download, then derive the status via
 * reconstructModStatus. Keyed by rule id.
 *
 * This is the single reconstruction used both when a session first starts (or resumes
 * after a restart, where the non-persisted session must be rebuilt from durable inputs)
 * and by the manual resync, so the two can never derive status differently.
 */
export function reconstructSessionMods(params: {
  rules: IModRule[];
  // keyed by mod id
  mods: Record<string, IMod>;
  // keyed by download id
  downloads: Record<string, IDownload>;
}): Record<string, ICollectionModInstallInfo> {
  const { rules, mods, downloads } = params;

  return Object.fromEntries(
    rules.filter(isDependencyRule).map((rule) => {
      const mod = findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule));
      const dlId = findDownloadByRef(rule.reference, downloads);
      const status = reconstructModStatus(rule, mod, dlId != null ? downloads[dlId] : undefined);

      const info: ICollectionModInstallInfo = {
        rule,
        status,
        type: rule.type as "requires" | "recommends",
        phase: rulePhase(rule),
      };
      // modId is "the installed mod reference (if installed)" - record it only for the
      // installed status (the only state planSessionResync carries a modId for)
      if (mod !== undefined && status === "installed") {
        info.modId = mod.id;
      }

      return [modRuleId(rule), info];
    }),
  );
}

/** A single status correction the resync should dispatch against the session. */
export interface ISessionResyncWrite {
  ruleId: string;
  status: ICollectionModInstallInfo["status"];
  // set only when status is "installed", so the caller records the matched mod id
  modId?: string;
}

/**
 * Diff the live session mods against the reconstruction from reality and return only the
 * entries that drifted. An "installed" entry whose modId no longer matches reality also
 * counts as drift (the row would link to a stale mod). Rules present in the session but
 * not in the reconstruction are left untouched.
 *
 * Unlike planSessionWrite (the automatic write path), this does not protect terminal
 * states: resync is an explicit user recovery where reality is authoritative, so it will
 * move a session entry off "installed"/"ignored" when reality no longer agrees.
 */
export function planSessionResync(
  // keyed by rule id
  currentMods: Record<string, ICollectionModInstallInfo>,
  // keyed by rule id
  reconstructed: Record<string, ICollectionModInstallInfo>,
): ISessionResyncWrite[] {
  const writes: ISessionResyncWrite[] = [];

  for (const [ruleId, current] of Object.entries(currentMods)) {
    const next = reconstructed[ruleId];
    if (next === undefined) {
      continue;
    }

    const installedWithMod = next.status === "installed" && next.modId !== undefined;
    const modIdChanged = installedWithMod && next.modId !== current.modId;
    if (next.status === current.status && !modIdChanged) {
      continue;
    }

    writes.push(
      installedWithMod
        ? { ruleId, status: next.status, modId: next.modId }
        : { ruleId, status: next.status },
    );
  }

  return writes;
}

/**
 * Reconstruct the given rules from reality, diff them against the active session and
 * dispatch only the corrections. Returns the number of entries corrected (0 when there is
 * no active session or nothing drifted). Shared core of the two resync entry points.
 *
 * Like markRuleIgnored, it writes directly (bypassing planSessionWrite): reality is
 * authoritative here, so it overrides even otherwise-protected states.
 */
function applySessionResync(api: IExtensionApi, rules: IModRule[]): number {
  const state = api.getState();
  const session = getCollectionActiveSession(state);
  if (session === undefined) {
    return 0;
  }

  const reconstructed = reconstructSessionMods({
    rules,
    mods: state.persistent.mods[session.gameId] ?? {},
    downloads: state.persistent.downloads.files,
  });
  const writes = planSessionResync(session.mods, reconstructed);

  if (writes.length === 0) {
    return 0;
  }

  const actions = writes.map((write) =>
    write.modId !== undefined
      ? installActions.markModInstalled(session.sessionId, write.ruleId, write.modId)
      : installActions.updateModStatus(session.sessionId, write.ruleId, write.status),
  );
  batchDispatch(api.store, actions);

  return writes.length;
}

/**
 * Manual recovery: rebuild the WHOLE active session's per-mod statuses from reality
 * (installed mods + downloads + each rule's durable ignored flag) and dispatch the
 * differences.
 *
 * The session is a precomputed cache that is deliberately NOT recomputed on every state
 * change (recomputing per row from multiple slices was the cost of the old modsEx cache).
 * It can therefore drift from reality if the user acts out of band mid-install (uninstall
 * a member, delete an archive, re-download). This is the explicit, on-demand way to realign
 * it without a hot-path selector storm.
 */
export function resyncCollectionSessionFromReality(api: IExtensionApi): number {
  const state = api.getState();
  const session = getCollectionActiveSession(state);
  if (session === undefined) {
    return 0;
  }
  // reconstruct from the collection mod's CURRENT rules (the durable source of truth), not
  // the session's rule snapshots. The session captures each rule at start and never refreshes
  // it, so reading the live rules picks up flags the user changed mid-install (e.g. ignored)
  // instead of reverting them.
  const rules = state.persistent.mods[session.gameId]?.[session.collectionId]?.rules ?? [];
  const changed = applySessionResync(api, rules);
  log("info", "resync collection session from reality", { changed });
  return changed;
}

/**
 * Realign the active session for a SPECIFIC set of rules from reality. Used when the user
 * toggles a per-mod decision mid-install (ignore / stop ignoring) and the session - the
 * source of truth while installing - must immediately reflect it without waiting for the
 * install to finish. Pass the rules carrying their NEW flag value (the session holds a
 * stale snapshot). Only the named rules are touched, so this does not perturb other
 * in-flight mods.
 */
export function resyncCollectionSessionRules(api: IExtensionApi, rules: IModRule[]): number {
  return applySessionResync(api, rules);
}
